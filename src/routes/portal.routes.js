import express from "express";
import passport from "passport";
import multer from "multer";
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as yup from "yup";
import ejs from "ejs";
import path from "path";
import { Op } from "sequelize";

import Project from "../models/project.js";
import Client from "../models/client.js";
import Ticket from "../models/ticket.js";
import Comment from "../models/comment.js";
import User from "../models/user.js";
import TimeLog from "../models/timelog.js";
import Group from "../models/group.js";
import OnCallSchedule from "../models/on-call-schedule.js";
import multerConfig from "../config/multer.js";
import credentials from "../config/credentials.js";
import MailService from "../services/mail.js";
import { loginLimiter } from "../config/limiters.js";

const router = express.Router();

// ============================================================
// Helper: Resolve para quais e-mails as notificações "de admin"
// de um projeto devem ir.
//
// Regra: o projeto está vinculado a um ou mais Grupos (times, ex.:
// Control-M, ITSM, Cyber Security...). Cada usuário que está
// atribuído a esse grupo (tabela user_groups, gerenciado em
// /admin/groups) deve receber a notificação — não é um e-mail
// único fixo por time, é a lista de e-mails de quem faz parte do
// grupo.
//
// Fallback: se o projeto não tiver grupo vinculado, ou o(s)
// grupo(s) vinculados não tiverem nenhum usuário, cai no
// ADMIN_EMAIL (caixa padrão de suporte).
//
// suporte@kakautech.com continua sendo apenas o REMETENTE (from) de
// todos os e-mails — isso é definido no MailService e não é afetado
// por esta função, que decide só o(s) destinatário(s) (to).
// ============================================================
function resolveTeamEmailsFromProject(project) {
  if (project && project.Groups && project.Groups.length > 0) {
    const emails = new Set();
    for (const group of project.Groups) {
      const users = group.Users || [];
      for (const user of users) {
        if (user.email) emails.add(user.email);
      }
    }
    if (emails.size > 0) return Array.from(emails).join(",");
  }
  return process.env.ADMIN_EMAIL;
}

async function resolveTeamEmailsByProjectId(projectId) {
  if (!projectId) return process.env.ADMIN_EMAIL;
  const project = await Project.findByPk(projectId, {
    include: [
      {
        model: Group,
        as: "Groups",
        include: [{ model: User, as: "Users", attributes: ["id", "name", "email"] }],
      },
    ],
  });
  return resolveTeamEmailsFromProject(project);
}

const s3 = new S3Client({
  region: credentials.region,
  credentials: {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  },
});

const statusTranslations = {
  open: "Aberto",
  pending: "Pendente",
  in_progress: "Em Andamento",
  closed: "Fechado",
};

// ============================================================
// Schemas de validação
// ============================================================
const registerSchema = yup.object().shape({
  name: yup.string().required("O nome é obrigatório."),
  email: yup
    .string()
    .email("Formato de email inválido.")
    .required("O email é obrigatório."),
  // Política de senha elevada para 8 caracteres com complexidade mínima
  password: yup
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .matches(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula.")
    .matches(/[0-9]/, "A senha deve conter ao menos um número.")
    .required("A senha é obrigatória."),
  projectId: yup.string().required("A seleção de um projeto é obrigatória."),
  terms: yup.string().oneOf(["on"], "Você deve aceitar os Termos de Uso e a Política de Privacidade.").required("Você deve aceitar os Termos de Uso e a Política de Privacidade."),
});

const ticketSchema = yup.object().shape({
  title: yup.string().required("O título é obrigatório."),
  description: yup.string().required("A descrição é obrigatória."),
  urgency: yup.string().required("A urgência é obrigatória."),
  category: yup.string(),
});

const commentSchema = yup.object().shape({
  content: yup
    .string()
    .required("O comentário não pode estar vazio.")
    .min(3, "O comentário é muito curto."),
});

const changePasswordSchema = yup.object().shape({
  new_password: yup
    .string()
    .min(8, "A nova senha deve ter no mínimo 8 caracteres.")
    .matches(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula.")
    .matches(/[0-9]/, "A senha deve conter ao menos um número.")
    .required("A nova senha é obrigatória."),
});

// ============================================================
// Tipos de arquivo permitidos no upload de avatar
// ============================================================
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ============================================================
// Middleware de autenticação
// ============================================================
const requireClientAuth = (req, res, next) => {
  if (
    req.isAuthenticated() &&
    req.user instanceof Client &&
    req.user.status === "active"
  ) {
    return next();
  }
  return res.redirect("/portal/login");
};

const loadProjectData = async (req, res, next) => {
  if (req.user && req.user.projectId) {
    const project = await Project.findByPk(req.user.projectId);
    if (project && project.support_hours_limit !== null) {
      res.locals.supportHoursLimit = project.support_hours_limit;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const totalSpentSeconds =
        (await TimeLog.sum("seconds_spent", {
          where: { createdAt: { [Op.gte]: startOfMonth } },
          include: [
            {
              model: Ticket,
              attributes: [],
              where: { projectId: project.id },
              required: true,
            },
          ],
        })) || 0;

      const usedHours = (totalSpentSeconds / 3600).toFixed(2);
      res.locals.usedSupportHours = usedHours;
    } else {
      res.locals.supportHoursLimit = null;
      res.locals.usedSupportHours = null;
    }
  }
  next();
};

const clientPortalMiddlewares = [requireClientAuth, loadProjectData];

// ============================================================
// Helper: lista de projetos para cadastro
// Retorna apenas nome e id — não expõe descrição, horas, etc.
// Randomiza a ordem para dificultar enumeração por posição.
// ============================================================
async function getPublicProjectList() {
  const projects = await Project.findAll({
    where: { status: "active" },
    attributes: ["id", "name"], // APENAS id e nome — sem outros dados
    order: [["name", "ASC"]],
  });
  return projects;
}

// ============================================================
// ROTAS
// ============================================================

router.get("/portal", (req, res) => {
  if (
    req.isAuthenticated() &&
    req.user instanceof Client &&
    req.user.status === "active"
  ) {
    res.redirect("/portal/dashboard");
  } else {
    res.redirect("/portal/login");
  }
});

router.get("/portal/dashboard", clientPortalMiddlewares, async (req, res) => {
  try {
    const projectId = req.user.projectId;
    const openTickets = await Ticket.count({
      where: { projectId, status: ["open", "pending", "in_progress"] },
    });
    const closedTickets = await Ticket.count({
      where: { projectId, status: "closed" },
    });

    // Busca plantonistas ativos dos grupos vinculados ao projeto do cliente
    let onCallSchedules = [];
    try {
      const now = new Date();

      // Grupos do projeto do cliente
      const project = await Project.findByPk(projectId, {
        include: [{ model: Group, as: "Groups", attributes: ["id"] }],
      });
      const groupIds = (project && project.Groups) ? project.Groups.map(g => g.id) : [];

      if (groupIds.length > 0) {
        onCallSchedules = await OnCallSchedule.findAll({
          where: {
            groupId: { [Op.in]: groupIds },
            startsAt: { [Op.lte]: now },
            endedAt: null,
            [Op.or]: [
              { endsAt: null },
              { endsAt: { [Op.gt]: now } },
            ],
          },
          include: [
            { model: User,  as: "User",  attributes: ["id", "name", "email", "phone"] },
            { model: Group, as: "Group", attributes: ["id", "name"] },
          ],
          order: [["startsAt", "ASC"]],
        });
      }
    } catch (oncallErr) {
      // Não deixa erro de plantão quebrar o dashboard
      console.error("Erro ao buscar plantonistas:", oncallErr);
    }

    res.render("portal/dashboard", {
      user: req.user,
      stats: { openTickets, closedTickets },
      onCallSchedules,
    });
  } catch (error) {
    console.error("Erro ao carregar o dashboard do cliente:", error);
    res.status(500).render("errors/500");
  }
});

router.get("/portal/login", (req, res) => {
  const messages = req.session.messages || [];
  req.session.messages = [];
  const error = messages.length > 0 ? messages[0] : null;
  res.render("client/client-login", { error });
});

router.post(
  "/portal/login",
  loginLimiter,
  passport.authenticate("local-client", {
    successRedirect: "/portal/dashboard",
    failureRedirect: "/portal/login",
    failureMessage: true,
  })
);

router.get("/portal/register", async (req, res) => {
  const projects = await getPublicProjectList();
  res.render("client/client-register", {
    error: null,
    projects,
    message: null,
  });
});

router.post("/portal/register", loginLimiter, async (req, res) => {
  const { name, email, password, projectId, terms } = req.body;
  const projects = await getPublicProjectList();
  try {
    await registerSchema.validate(
      { name, email, password, projectId, terms },
      { abortEarly: false }
    );
    const existingClient = await Client.findOne({ where: { email } });
    if (existingClient) {
      return res.status(400).render("client/client-register", {
        error: "Este e-mail já está cadastrado.",
        projects,
        message: null,
      });
    }

    // Valida que o projectId informado realmente existe e está ativo
    const projectExists = await Project.findOne({
      where: { id: projectId, status: "active" },
      attributes: ["id", "name"],
    });
    if (!projectExists) {
      return res.status(400).render("client/client-register", {
        error: "Projeto inválido.",
        projects,
        message: null,
      });
    }

    const newClient = await Client.create({
      name,
      email,
      password,
      projectId,
      status: "pending",
    });

    try {
      const emailHtml = await ejs.renderFile(
        path.join(__dirname, "../views/emails/newClientPending.ejs"),
        {
          clientName: newClient.name,
          clientEmail: newClient.email,
          projectName: projectExists.name,
          adminUrl: `${process.env.BASE_URL || "http://localhost:5000"}/admin/resources/clients`,
        }
      );
      const adminRecipients = await resolveTeamEmailsByProjectId(projectId);
      await MailService.sendMail(
        adminRecipients,
        `Novo Cliente Pendente: ${newClient.name}`,
        emailHtml
      );
    } catch (mailError) {
      console.error("Falha ao enviar email de novo cliente pendente:", mailError);
    }

    return res.render("portal/pending-approval");
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).render("client/client-register", {
        error: error.errors.join(". "),
        projects,
        message: null,
      });
    }
    console.error("Erro no cadastro do cliente:", error);
    return res.status(500).render("client/client-register", {
      error: "Ocorreu um erro inesperado.",
      projects,
      message: null,
    });
  }
});

const socialAuthCallback = (req, res, next) => {
  if (
    req.session.messages &&
    req.session.messages.includes("PENDING_APPROVAL")
  ) {
    req.session.messages = [];
    return res.redirect("/portal/pending-approval");
  }
  req.login(req.user, (err) => {
    if (err) return next(err);
    return res.redirect("/portal/dashboard");
  });
};

router.get(
  "/auth/google",
  passport.authenticate("google-client", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google-client", {
    failureRedirect: "/portal/login",
    failureMessage: true,
  }),
  socialAuthCallback
);
router.get("/auth/microsoft", passport.authenticate("microsoft-client"));
router.get(
  "/auth/microsoft/callback",
  passport.authenticate("microsoft-client", {
    failureRedirect: "/portal/login",
    failureMessage: true,
  }),
  socialAuthCallback
);

router.get("/portal/pending-approval", (req, res) => {
  res.render("portal/pending-approval");
});

router.get("/portal/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    req.session.destroy(() => res.redirect("/portal/login"));
  });
});

router.get(
  "/portal/download/ticket/:recordId",
  clientPortalMiddlewares,
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const ticket = await Ticket.findByPk(recordId);
      if (!ticket || !ticket.path) return res.status(404).send("Anexo não encontrado.");
      if (ticket.projectId !== req.user.projectId) return res.status(403).send("Acesso negado.");
      const command = new GetObjectCommand({ Bucket: ticket.folder, Key: ticket.path });
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });
      res.redirect(signedUrl);
    } catch (error) {
      console.error("Erro ao gerar link de download:", error);
      res.status(500).send("Erro ao processar o download.");
    }
  }
);

router.get(
  "/portal/download/comment/:commentId",
  requireClientAuth,
  async (req, res) => {
    try {
      const { commentId } = req.params;
      const comment = await Comment.findByPk(commentId);
      if (!comment || !comment.path) return res.status(404).send("Anexo não encontrado.");
      const ticket = await Ticket.findByPk(comment.ticket_id);
      if (!ticket || ticket.projectId !== req.user.projectId) return res.status(403).send("Acesso negado.");
      const command = new GetObjectCommand({ Bucket: comment.folder, Key: comment.path });
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });
      res.redirect(signedUrl);
    } catch (error) {
      console.error("Erro ao gerar link de download do comentário:", error);
      res.status(500).send("Erro ao processar o download.");
    }
  }
);

router.get("/portal/profile", clientPortalMiddlewares, async (req, res) => {
  const clientWithProject = await Client.findByPk(req.user.id, {
    include: [{ model: Project, as: "Project" }],
  });

  let avatarUrl = null;
  if (clientWithProject && clientWithProject.avatar_path) {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: clientWithProject.avatar_path,
    });
    avatarUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  }

  res.render("portal/profile", {
    user: clientWithProject,
    avatarUrl,
    error: null,
    success: null,
  });
});

router.post("/portal/profile", clientPortalMiddlewares, async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  const client = await Client.findByPk(req.user.id, {
    include: [{ model: Project, as: "Project" }],
  });

  const isPasswordCorrect = await client.checkPassword(current_password);
  if (!isPasswordCorrect) {
    return res.render("portal/profile", {
      user: client,
      avatarUrl: null,
      success: null,
      error: "A senha atual está incorreta.",
    });
  }

  // Valida nova senha com a política elevada
  try {
    await changePasswordSchema.validate({ new_password });
  } catch (validationError) {
    return res.render("portal/profile", {
      user: client,
      avatarUrl: null,
      success: null,
      error: validationError.message,
    });
  }

  if (new_password !== confirm_password) {
    return res.render("portal/profile", {
      user: client,
      avatarUrl: null,
      success: null,
      error: "A nova senha e a confirmação não coincidem.",
    });
  }

  try {
    client.password = new_password;
    await client.save();
    res.render("portal/profile", {
      user: client,
      avatarUrl: null,
      error: null,
      success: "Senha alterada com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao salvar nova senha:", error);
    res.render("portal/profile", {
      user: client,
      avatarUrl: null,
      success: null,
      error: "Ocorreu um erro ao salvar a nova senha. Tente novamente.",
    });
  }
});

router.post(
  "/portal/profile/avatar",
  clientPortalMiddlewares,
  multer(multerConfig).single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) return res.redirect("/portal/profile");

      // Validação explícita de tipo e tamanho no backend
      if (!ALLOWED_AVATAR_TYPES.includes(req.file.mimetype)) {
        return res.render("portal/profile", {
          user: req.user,
          avatarUrl: null,
          success: null,
          error: "Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.",
        });
      }
      if (req.file.size > MAX_AVATAR_SIZE_BYTES) {
        return res.render("portal/profile", {
          user: req.user,
          avatarUrl: null,
          success: null,
          error: "Arquivo muito grande. Máximo 5 MB.",
        });
      }

      const client = await Client.findByPk(req.user.id);

      if (client.avatar_path) {
        await s3.send(new DeleteObjectCommand({
          Bucket: process.env.AWS_BUCKET,
          Key: client.avatar_path,
        }));
      }

      client.avatar_path = req.file.key;
      await client.save();

      return res.redirect("/portal/profile");
    } catch (error) {
      console.error("Erro no upload do avatar:", error);
      return res.redirect("/portal/profile");
    }
  }
);

router.get("/portal/tickets", clientPortalMiddlewares, async (req, res) => {
  try {
    const { status, search } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const where = { projectId: req.user.projectId };
    if (status) where.status = status;
    if (search) where.title = { [Op.iLike]: `%${search}%` };

    const { count, rows: tickets } = await Ticket.findAndCountAll({
      where,
      limit,
      offset,
      order: [["updatedAt", "DESC"]],
      include: [{ model: Client, as: "Client", attributes: ["name"] }],
    });

    const totalPages = Math.ceil(count / limit);

    res.render("portal/list-tickets", {
      user: req.user,
      tickets,
      statusTranslations,
      totalPages,
      currentPage: page,
      currentStatus: status || "",
      currentSearch: search || "",
    });
  } catch (error) {
    console.error("Erro ao buscar chamados:", error);
    res.status(500).render("errors/500");
  }
});

router.get("/portal/tickets/new", clientPortalMiddlewares, (req, res) => {
  res.render("portal/new-ticket", {
    message: null,
    error: null,
    user: req.user,
  });
});

router.get("/portal/tickets/:id", clientPortalMiddlewares, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      where: { id: req.params.id, projectId: req.user.projectId },
      include: [
        { model: Client, as: "Client", attributes: ["name"] },
        {
          model: Comment,
          include: [
            { model: User, attributes: ["name"] },
            { model: Client, attributes: ["name"] },
          ],
        },
      ],
      order: [[Comment, "createdAt", "ASC"]],
    });
    if (!ticket) return res.status(404).render("errors/404", { context: "portal" });

    for (const comment of ticket.comments) {
      if (comment.filename && comment.type && comment.type.startsWith("image/")) {
        const command = new GetObjectCommand({ Bucket: comment.folder, Key: comment.path });
        comment.previewUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      }
    }

    res.render("portal/ticket-detail", {
      user: req.user,
      ticket,
      error: null,
      statusTranslations,
    });
  } catch (error) {
    console.error("Erro ao buscar detalhes do chamado:", error);
    res.status(500).render("errors/500");
  }
});

router.post(
  "/portal/tickets/:id/comments",
  clientPortalMiddlewares,
  multer(multerConfig).single("attachment"),
  async (req, res) => {
    const ticketId = req.params.id;
    try {
      const { content } = req.body;
      await commentSchema.validate({ content });

      const ticket = await Ticket.findOne({
        where: { id: ticketId, projectId: req.user.projectId },
        include: [{ model: User, as: "User" }],
      });
      if (!ticket) return res.status(404).render("errors/404", { context: "portal" });

      const commentData = {
        content,
        ticket_id: ticketId,
        client_id: req.user.id,
      };
      if (req.file) {
        const { key, size, mimetype, originalname } = req.file;
        Object.assign(commentData, {
          path: key,
          folder: process.env.AWS_BUCKET,
          type: mimetype,
          filename: originalname,
          size,
        });
      }

      const newComment = await Comment.create(commentData);

      try {
        const client = req.user;
        const teamEmails = await resolveTeamEmailsByProjectId(ticket.projectId);
        const recipients = new Set(
          (teamEmails || "").split(",").map((e) => e.trim()).filter(Boolean)
        );
        if (ticket.User && ticket.User.email) recipients.add(ticket.User.email);

        const emailHtml = await ejs.renderFile(
          path.join(__dirname, "../views/emails/newCommentByClient.ejs"),
          {
            clientName: client.name,
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            commentContent: newComment.content,
            adminTicketUrl: `${process.env.BASE_URL || "http://localhost:5000"}/admin/resources/tickets/records/${ticket.id}/show`,
          }
        );

        await MailService.sendMail(
          Array.from(recipients),
          `Nova Resposta do ${client.name} no Chamado ${ticket.title}`,
          emailHtml
        );
      } catch (mailError) {
        console.error("Falha ao enviar email de notificação de comentário:", mailError);
      }

      res.redirect(`/portal/tickets/${ticketId}`);
    } catch (error) {
      const ticket = await Ticket.findOne({
        where: { id: ticketId, projectId: req.user.projectId },
        include: [{ model: Comment, include: [User, Client] }],
        order: [[Comment, "createdAt", "ASC"]],
      });
      if (error instanceof yup.ValidationError) {
        return res.status(400).render("portal/ticket-detail", {
          user: req.user,
          ticket,
          error: error.message,
          statusTranslations,
        });
      }
      console.error("Erro ao adicionar comentário:", error);
      res.status(500).render("errors/500");
    }
  }
);

router.post(
  "/portal/tickets",
  clientPortalMiddlewares,
  multer(multerConfig).single("attachment"),
  async (req, res) => {
    try {
      const { title, description, urgency, category } = req.body;
      const client = req.user;
      const project = await Project.findByPk(client.projectId, {
        include: [
          {
            model: Group,
            as: "Groups",
            include: [{ model: User, as: "Users", attributes: ["id", "name", "email"] }],
          },
        ],
      });

      // Verificação de limite de horas usando TimeLog (fonte de verdade correta)
      if (project && project.support_hours_limit !== null) {
        const totalSpentSeconds =
          (await TimeLog.sum("seconds_spent", {
            include: [
              {
                model: Ticket,
                attributes: [],
                where: { projectId: project.id },
                required: true,
              },
            ],
          })) || 0;
        const limitInSeconds = project.support_hours_limit * 3600;
        if (totalSpentSeconds >= limitInSeconds) {
          return res.status(403).render("portal/new-ticket", {
            message: null,
            error: `O limite de horas de suporte para este projeto foi atingido. Por favor, entre em contato com a Kakau Tech.`,
            user: client,
          });
        }
      }

      await ticketSchema.validate({ title, description, urgency });

      const ticketData = {
        title,
        description,
        urgency,
        category,
        type: "incident",
        clientId: client.id,
        projectId: client.projectId,
        status: "open",
      };

      if (req.file) {
        const { key, size, mimetype, originalname } = req.file;
        Object.assign(ticketData, {
          path: key,
          folder: process.env.AWS_BUCKET,
          file_type: mimetype,
          filename: originalname,
          size,
        });
      }

      const newTicket = await Ticket.create(ticketData);

      try {
        const projectName = project ? project.name : "Não especificado";

        const adminRecipients = resolveTeamEmailsFromProject(project);

        const emailHtmlAdmin = await ejs.renderFile(
          path.join(__dirname, "../views/emails/newTicketNotification.ejs"),
          {
            clientName: client.name,
            clientEmail: client.email,
            ticketTitle: newTicket.title,
            ticketDescription: newTicket.description,
            projectName,
          }
        );
        await MailService.sendMail(
          adminRecipients,
          `Novo Chamado: ${newTicket.title} [Projeto: ${projectName}]`,
          emailHtmlAdmin
        );
      } catch (mailError) {
        console.error("Falha ao enviar email para o Admin:", mailError);
      }

      try {
        const emailHtmlClient = await ejs.renderFile(
          path.join(__dirname, "../views/emails/ticketReceived.ejs"),
          {
            clientName: client.name,
            ticketId: newTicket.id,
            ticketTitle: newTicket.title,
            ticketUrl: `${process.env.BASE_URL || "http://localhost:5000"}/portal/tickets/${newTicket.id}`,
          }
        );
        await MailService.sendMail(
          client.email,
          `Seu Chamado ${newTicket.title} Foi Recebido`,
          emailHtmlClient
        );
      } catch (mailError) {
        console.error("Falha ao enviar email de confirmação para o cliente:", mailError);
      }

      res.redirect("/portal/tickets");
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        return res.status(400).render("portal/new-ticket", {
          message: null,
          error: error.message,
          user: req.user,
        });
      }
      console.error("Erro ao criar chamado:", error);
      res.status(500).render("portal/new-ticket", {
        message: null,
        error: `Erro: ${error.message}`,
        user: req.user,
      });
    }
  }
);

export default router;
