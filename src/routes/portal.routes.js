import express from "express";
import passport from "passport";
import multer from "multer";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as yup from "yup";
import ejs from "ejs";
import path from "path";

import Project from "../models/project";
import Client from "../models/client";
import Ticket from "../models/ticket";
import Comment from "../models/comment";
import User from "../models/user";
import multerConfig from "../config/multer";
import credentials from "../config/credentials";
import MailService from "../services/mail";

const router = express.Router();

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

router.get("/portal", (req, res) => {
  if (
    req.isAuthenticated() &&
    req.user instanceof Client &&
    req.user.status === "active"
  ) {
    res.redirect("/portal/tickets");
  } else {
    res.redirect("/portal/login");
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
    successRedirect: "/portal/tickets",
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

router.post("/portal/register", async (req, res, next) => {
  const { name, email, password, projectId } = req.body;
  const projects = await Project.findAll({ where: { status: "active" } });
  try {
    await registerSchema.validate(
      { name, email, password, projectId },
      { abortEarly: false }
    );
    const existingClient = await Client.findOne({ where: { email } });
    if (existingClient) {
      return res
        .status(400)
        .render("client/client-register", {
          error: "Este e-mail já está cadastrado...",
          projects,
          message: null,
        });
    }
    await Client.create({
      name,
      email,
      password,
      projectId,
      status: "pending",
    });
    return res.render("client/client-register", {
      message: "Solicitação de cadastro enviada com sucesso!",
      projects,
      error: null,
    });
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res
        .status(400)
        .render("client/client-register", {
          error: error.errors.join(". "),
          projects,
          message: null,
        });
    }
    console.error("Erro no cadastro do cliente:", error);
    return res
      .status(500)
      .render("client/client-register", {
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
    return res.redirect("/portal/tickets");
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
  requireClientAuth,
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const ticket = await Ticket.findByPk(recordId);
      if (!ticket || !ticket.path) {
        return res.status(404).send("Anexo não encontrado.");
      }
      if (ticket.clientId !== req.user.id) {
        return res.status(403).send("Acesso negado.");
      }
      const s3 = new S3Client({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      });
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

router.get("/portal/tickets", requireClientAuth, async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      where: { clientId: req.user.id },
      order: [["updatedAt", "DESC"]],
    });
    res.render("portal/list-tickets", { user: req.user, tickets });
  } catch (error) {
    console.error("Erro ao buscar chamados:", error);
    res.status(500).render("errors/500");
  }
});

router.get("/portal/tickets/new", requireClientAuth, (req, res) => {
  res.render("portal/new-ticket", {
    message: null,
    error: null,
    user: req.user,
  });
});

router.get("/portal/tickets/:id", requireClientAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      where: { id: req.params.id, clientId: req.user.id },
      include: [
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

    res.render("portal/ticket-detail", { user: req.user, ticket, error: null });
  } catch (error) {
    console.error("Erro ao buscar detalhes do chamado:", error);
    res.status(500).render("errors/500");
  }
});

router.post(
  "/portal/tickets/:id/comments",
  requireClientAuth,
  async (req, res) => {
    const ticketId = req.params.id;
    try {
      const { content } = req.body;
      await commentSchema.validate({ content });

      const ticket = await Ticket.findOne({
        where: { id: ticketId, clientId: req.user.id },
      });
      if (!ticket) {
        return res.status(404).render("errors/404", { context: "portal" });
      }

      await Comment.create({
        content,
        ticket_id: ticketId,
        client_id: req.user.id,
      });

      res.redirect(`/portal/tickets/${ticketId}`);
    } catch (error) {
      const ticket = await Ticket.findOne({
        where: { id: ticketId, clientId: req.user.id },
        include: [{ model: Comment, include: [User, Client] }],
        order: [[Comment, "createdAt", "ASC"]],
      });

      if (error instanceof yup.ValidationError) {
        return res
          .status(400)
          .render(`portal/ticket-detail`, {
            user: req.user,
            ticket,
            error: error.message,
          });
      }
      console.error("Erro ao adicionar comentário:", error);
      res.status(500).render("errors/500");
    }
  }
);

router.post(
  "/portal/tickets",
  requireClientAuth,
  multer(multerConfig).single("attachment"),
  async (req, res) => {
    try {
      const { title, description } = req.body;
      await ticketSchema.validate({ title, description });
      const ticketData = {
        title,
        description,
        clientId: req.user.id,
        projectId: req.user.projectId,
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
        const project = await Project.findByPk(newTicket.projectId);
        const projectName = project ? project.name : "Não especificado";
        const emailHtml = await ejs.renderFile(
          path.join(__dirname, "../views/emails/newTicketNotification.ejs"),
          {
            clientName: req.user.name,
            clientEmail: req.user.email,
            ticketTitle: newTicket.title,
            ticketDescription: newTicket.description,
            projectName: projectName,
          }
        );
        await MailService.sendMail(
          process.env.ADMIN_EMAIL,
          `Novo Chamado: ${newTicket.title} [Projeto: ${projectName}]`,
          emailHtml
        );
      } catch (mailError) {
        console.error("Falha ao enviar email de notificação:", mailError);
      }
      res.redirect("/portal/tickets");
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        return res
          .status(400)
          .render("portal/new-ticket", {
            message: null,
            error: error.message,
            user: req.user,
          });
      }
      console.error("Erro ao criar chamado:", error);
      res
        .status(500)
        .render("portal/new-ticket", {
          message: null,
          error: `Erro: ${error.message}`,
          user: req.user,
        });
    }
  }
);

export default router;