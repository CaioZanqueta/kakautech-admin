import express from "express";
import passport from "passport";
import multer from "multer";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as yup from "yup";
import ejs from "ejs";
import path from "path";
import { Op } from "sequelize";

import Project from "../models/project";
import Client from "../models/client";
import Ticket from "../models/ticket";
import Comment from "../models/comment";
import User from "../models/user";
import multerConfig from "../config/multer";
import credentials from "../config/credentials";
import MailService from "../services/mail";

const router = express.Router();

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

const registerSchema = yup.object().shape({
  name: yup.string().required("O nome é obrigatório."),
  email: yup
    .string()
    .email("Formato de email inválido.")
    .required("O email é obrigatório."),
  password: yup
    .string()
    .min(6, "A senha deve ter no mínimo 6 caracteres.")
    .required("A senha é obrigatória."),
  projectId: yup.string().required("A seleção de um projeto é obrigatória."),
});
const ticketSchema = yup.object().shape({
  title: yup.string().required("O título é obrigatório."),
  description: yup.string().required("A descrição é obrigatória."),
});
const commentSchema = yup.object().shape({
  content: yup
    .string()
    .required("O comentário não pode estar vazio.")
    .min(3, "O comentário é muito curto."),
});
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
      const totalSpentSeconds =
        (await Ticket.sum("time_spent_seconds", {
          where: { projectId: project.id },
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

    res.render("portal/dashboard", {
      user: req.user,
      stats: {
        openTickets,
        closedTickets,
      },
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
  passport.authenticate("local-client", {
    successRedirect: "/portal/dashboard",
    failureRedirect: "/portal/login",
    failureMessage: true,
  })
);
router.get("/portal/register", async (req, res) => {
  const projects = await Project.findAll({ where: { status: "active" } });
  res.render("client/client-register", {
    error: null,
    projects,
    message: null,
  });
});

router.post("/portal/register", async (req, res) => {
  const { name, email, password, projectId } = req.body;
  const projects = await Project.findAll({ where: { status: "active" } });
  try {
    await registerSchema.validate(
      { name, email, password, projectId },
      { abortEarly: false }
    );
    const existingClient = await Client.findOne({ where: { email } });
    if (existingClient) {
      return res.status(400).render("client/client-register", {
        error: "Este e-mail já está cadastrado...",
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
      const project = await Project.findByPk(projectId);
      const emailHtml = await ejs.renderFile(
        path.join(__dirname, "../views/emails/newClientPending.ejs"),
        {
          clientName: newClient.name,
          clientEmail: newClient.email,
          projectName: project ? project.name : "N/A",
          adminUrl: `${req.protocol}://${req.get(
            "host"
          )}/admin/resources/clients`,
        }
      );
      await MailService.sendMail(
        process.env.ADMIN_EMAIL,
        `Novo Cliente Pendente: ${newClient.name}`,
        emailHtml
      );
    } catch (mailError) {
      console.error(
        "Falha ao enviar email de novo cliente pendente:",
        mailError
      );
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
    if (err) {
      return next(err);
    }
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
    if (err) {
      return next(err);
    }
    req.session.destroy(() => {
      res.redirect("/portal/login");
    });
  });
});

router.get(
  "/portal/download/ticket/:recordId",
  clientPortalMiddlewares,
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const ticket = await Ticket.findByPk(recordId);
      if (!ticket || !ticket.path) {
        return res.status(404).send("Anexo não encontrado.");
      }
      if (ticket.projectId !== req.user.projectId) {
        return res.status(403).send("Acesso negado.");
      }
      const command = new GetObjectCommand({
        Bucket: ticket.folder,
        Key: ticket.path,
      });
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
      if (!comment || !comment.path) {
        return res.status(404).send("Anexo não encontrado.");
      }
      const ticket = await Ticket.findByPk(comment.ticket_id);
      if (!ticket || ticket.projectId !== req.user.projectId) {
        return res.status(403).send("Acesso negado.");
      }
      const command = new GetObjectCommand({
        Bucket: comment.folder,
        Key: comment.path,
      });
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });
      res.redirect(signedUrl);
    } catch (error) {
      console.error("Erro ao gerar link de download do comentário:", error);
      res.status(500).send("Erro ao processar o download.");
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
    if (status) {
      where.status = status;
    }
    if (search) {
      where.title = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows: tickets } = await Ticket.findAndCountAll({
      where,
      limit,
      offset,
      order: [["updatedAt", "DESC"]],
      include: [
        {
          model: Client,
          as: 'Client', // MODIFICAÇÃO: Usa o alias
          attributes: ['name'],
        },
      ],
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
        {
          model: Client,
          as: 'Client', // MODIFICAÇÃO: Usa o alias
          attributes: ['name'],
        },
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
    if (!ticket) {
      return res.status(404).render("errors/404", { context: "portal" });
    }
    for (const comment of ticket.comments) {
      if (comment.filename && comment.type.startsWith("image/")) {
        const command = new GetObjectCommand({
          Bucket: comment.folder,
          Key: comment.path,
        });
        comment.previewUrl = await getSignedUrl(s3, command, {
          expiresIn: 3600,
        });
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
        include: User,
      });

      if (!ticket) {
        return res.status(404).render("errors/404", { context: "portal" });
      }

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
          size: size,
        });
      }

      const newComment = await Comment.create(commentData);

      try {
        const client = req.user;
        const recipients = new Set([process.env.ADMIN_EMAIL]);
        if (ticket.User && ticket.User.email) {
          recipients.add(ticket.User.email);
        }

        const emailHtml = await ejs.renderFile(
          path.join(__dirname, "../views/emails/newCommentByClient.ejs"),
          {
            clientName: client.name,
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            commentContent: newComment.content,
            adminTicketUrl: `${req.protocol}://${req.get(
              "host"
            )}/admin/resources/tickets/records/${ticket.id}/show`,
          }
        );

        await MailService.sendMail(
          Array.from(recipients),
          `Nova Resposta do ${client.name} no Chamado ${ticket.title}`,
          emailHtml
        );
      } catch (mailError) {
        console.error(
          "Falha ao enviar email de notificação de comentário do cliente:",
          mailError
        );
      }

      res.redirect(`/portal/tickets/${ticketId}`);
    } catch (error) {
      const ticket = await Ticket.findOne({
        where: { id: ticketId, projectId: req.user.projectId },
        include: [{ model: Comment, include: [User, Client] }],
        order: [[Comment, "createdAt", "ASC"]],
      });
      if (error instanceof yup.ValidationError) {
        return res.status(400).render(`portal/ticket-detail`, {
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
      const { title, description, priority } = req.body;
      const client = req.user;
      const project = await Project.findByPk(client.projectId);
      if (project && project.support_hours_limit !== null) {
        const totalSpentSeconds =
          (await Ticket.sum("time_spent_seconds", {
            where: { projectId: project.id },
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
      await ticketSchema.validate({ title, description });
      const ticketData = {
        title,
        description,
        priority,
        clientId: client.id,
        projectId: client.projectId,
        status: "open",
      };
      if (req.file) {
        const { key, size, mimetype, originalname } = req.file;
        Object.assign(ticketData, {
          path: key,
          folder: process.env.AWS_BUCKET,
          type: mimetype,
          filename: originalname,
          size: size,
        });
      }
      const newTicket = await Ticket.create(ticketData);

      try {
        const projectName = project ? project.name : "Não especificado";
        const emailHtmlAdmin = await ejs.renderFile(
          path.join(__dirname, "../views/emails/newTicketNotification.ejs"),
          {
            clientName: client.name,
            clientEmail: client.email,
            ticketTitle: newTicket.title,
            ticketDescription: newTicket.description,
            projectName: projectName,
          }
        );
        await MailService.sendMail(
          process.env.ADMIN_EMAIL,
          `Novo Chamado: ${newTicket.title} [Projeto: ${projectName}]`,
          emailHtmlAdmin
        );
      } catch (mailError) {
        console.error(
          "Falha ao enviar email de notificação para o Admin:",
          mailError
        );
      }

      try {
        const emailHtmlClient = await ejs.renderFile(
          path.join(__dirname, "../views/emails/ticketReceived.ejs"),
          {
            clientName: client.name,
            ticketId: newTicket.id,
            ticketTitle: newTicket.title,
            ticketUrl: `${req.protocol}://${req.get("host")}/portal/tickets/${
              newTicket.id
            }`,
          }
        );
        await MailService.sendMail(
          client.email,
          `Seu Chamado ${newTicket.title} Foi Recebido`,
          emailHtmlClient
        );
      } catch (mailError) {
        console.error(
          "Falha ao enviar email de confirmação para o cliente:",
          mailError
        );
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