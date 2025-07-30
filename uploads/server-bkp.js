import "dotenv/config";
import "./database"; // <<-- CORRIGIDO: Sem /index.js

import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import AdminJSSequelize from "@adminjs/sequelize";
import express from "express";
import session from "express-session";
import path from "path";
import multer from "multer";
import multerConfig from "./config/multer";
import passport from "./config/passport";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import credentials from "./config/credentials";
import MailService from "./services/mail";
import ejs from 'ejs';

// <<-- CORRIGIDO: Todas as importações locais sem a extensão .js -->>
import UsersResource from "./resources/UsersResource";
import ProjectsResource from "./resources/ProjectsResource";
import TasksResource from "./resources/TasksResource";
import User from "./models/user";
import ClientsResource from "./resources/ClientsResource";
import TicketsResource from "./resources/TicketsResource";
import Client from "./models/client";
import Ticket from "./models/ticket";
import Project from "./models/project";
import locale from "./locales";
import theme from "./theme";

AdminJS.registerAdapter(AdminJSSequelize);

const app = express();

app.use((req, res, next) => {
  next();
});

app.use("/public", express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // __dirname funciona por defeito neste ambiente

const adminJS = new AdminJS({
  databases: [],
  rootPath: "/admin",
  dashboard: {
    component: AdminJS.bundle("./components/Dashboard/index"),
  },
  resources: [
    UsersResource,
    ProjectsResource,
    TasksResource,
    ClientsResource,
    TicketsResource,
  ],
  branding: {
    companyName: "Kakau Tech",
    logo: "/public/kakau.webp",
    favicon: "/public/favicon.webp",
    softwareBrothers: false,
    theme,
  },
  ...locale,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);
app.use(passport.initialize());
app.use(passport.session());

const adminRouter = AdminJSExpress.buildRouter(adminJS);

app.get("/admin/login", (req, res) => {
  const messages = req.session.messages || [];
  req.session.messages = [];
  const error = messages.length > 0 ? messages[0] : null;
  res.render("admin-login", { error });
});

app.post("/admin/login", async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const adminUser = await User.findOne({ where: { email } });
    if (!adminUser) {
      return res.render("admin-login", { error: "Email ou senha inválidos." });
    }
    const isPasswordCorrect = await adminUser.checkPassword(password);
    if (isPasswordCorrect) {
      req.login(adminUser, (err) => {
        if (err) { return next(err); }
        req.session.adminUser = adminUser.toJSON();
        req.session.save((saveErr) => {
          if (saveErr) {
            return next(saveErr);
          }
          return res.redirect("/admin");
        });
      });
    } else {
      res.render("admin-login", { error: "Email ou senha inválidos." });
    }
  } catch (error) {
    console.error("ERRO GERAL NO LOGIN:", error);
    next(error);
  }
});

const checkAdminAuth = (req, res, next) => {
    if (req.session.adminUser) { return next(); }
    if (req.isAuthenticated() && req.user instanceof User) { return next(); }
    return res.redirect("/admin/login");
};

const mainAdminRouter = (req, res, next) => {
    if (req.originalUrl.startsWith('/admin/login') || req.originalUrl.startsWith('/admin/auth')) {
        return adminRouter(req, res, next);
    }
    return checkAdminAuth(req, res, () => adminRouter(req, res, next));
}

app.use(adminJS.options.rootPath, mainAdminRouter);

app.get("/admin/auth/google", passport.authenticate("google-admin"));
app.get(
  "/admin/auth/google/callback",
  passport.authenticate("google-admin", {
    failureRedirect: "/admin/login",
    failureMessage: true,
  }),
  (req, res, next) => {
    if (req.user) {
        req.session.adminUser = req.user.toJSON();
        req.session.save(() => res.redirect('/admin'));
    } else {
        res.redirect('/admin/login');
    }
  }
);

app.get("/admin/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    delete req.session.adminUser;
    req.session.destroy(() => {
      res.redirect("/admin/login");
    });
  });
});

const requireClientAuth = (req, res, next) => {
  if (req.isAuthenticated() && req.user instanceof Client && req.user.status === 'active') {
    return next();
  }
  return res.redirect("/portal/login");
};
app.get("/portal", (req, res) => {
  if (req.isAuthenticated() && req.user instanceof Client && req.user.status === 'active') {
    res.redirect("/portal/tickets");
  } else {
    res.redirect("/portal/login");
  }
});
app.get("/portal/login", (req, res) => {
  const messages = req.session.messages || [];
  req.session.messages = [];
  const error = messages.length > 0 ? messages[0] : null;
  res.render("client-login", { error });
});
app.post("/portal/login", passport.authenticate("local-client", {
    successRedirect: "/portal/tickets",
    failureRedirect: "/portal/login",
    failureMessage: true,
}));
app.get("/portal/register", async (req, res) => {
  const projects = await Project.findAll({ where: { status: 'active' } });
  res.render("client-register", { error: null, projects, message: null });
});
app.post("/portal/register", async (req, res, next) => {
  const { name, email, password, projectId } = req.body;
  const projects = await Project.findAll({ where: { status: 'active' } });
  try {
    const existingClient = await Client.findOne({ where: { email } });
    if (existingClient) {
      return res.render("client-register", {
        error: "Este e-mail já está cadastrado. Tente fazer o login.",
        projects, message: null
      });
    }
    await Client.create({ name, email, password, projectId, status: 'pending' });
    return res.render("client-register", {
      message: "Solicitação de cadastro enviada com sucesso! Você será notificado quando sua conta for aprovada.",
      projects, error: null
    });
  } catch (error) {
    console.error("Erro no cadastro do cliente:", error);
    res.render("client-register", {
      error: "Ocorreu um erro inesperado. Tente novamente.",
      projects, message: null
    });
  }
});
const socialAuthCallback = (req, res, next) => {
    if (req.session.messages && req.session.messages.includes('PENDING_APPROVAL')) {
        req.session.messages = [];
        return res.redirect('/portal/pending-approval');
    }
    req.login(req.user, (err) => {
      if (err) { return next(err); }
      return res.redirect("/portal/tickets");
    });
};
app.get("/auth/google", passport.authenticate("google-client", { scope: ["profile", "email"] }));
app.get("/auth/google/callback", passport.authenticate("google-client", { failureRedirect: "/portal/login", failureMessage: true }), socialAuthCallback);
app.get("/auth/microsoft", passport.authenticate("microsoft-client"));
app.get("/auth/microsoft/callback", passport.authenticate("microsoft-client", { failureRedirect: "/portal/login", failureMessage: true }), socialAuthCallback);
app.get("/portal/pending-approval", (req, res) => {
    res.render("pending-approval");
});
app.get("/portal/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) { return next(err); }
    req.session.destroy(() => {
      res.redirect("/portal/login");
    });
  });
});
app.get("/portal/download/ticket/:recordId", requireClientAuth, async (req, res) => {
  try {
    const { recordId } = req.params;
    const ticket = await Ticket.findByPk(recordId);
    if (!ticket || !ticket.path) {
      return res.status(404).send("Anexo não encontrado ou ticket inválido.");
    }
    if (ticket.clientId !== req.user.id) {
      return res.status(403).send("Acesso negado.");
    }
    const s3 = new S3Client({
      region: credentials.region,
      credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey },
    });
    const command = new GetObjectCommand({ Bucket: ticket.folder, Key: ticket.path });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });
    res.redirect(signedUrl);
  } catch (error) {
    console.error("Erro ao gerar link de download:", error);
    res.status(500).send("Erro ao processar o download.");
  }
});
app.get("/portal/tickets", requireClientAuth, async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      where: { clientId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    res.render("list-tickets", { user: req.user, tickets });
  } catch (error) {
    console.error("Erro ao buscar chamados:", error);
    res.status(500).send("Erro ao carregar seus chamados.");
  }
});
app.get("/portal/tickets/new", requireClientAuth, (req, res) => {
  res.render("new-ticket", { message: null, error: null, user: req.user });
});
app.post(
  "/portal/tickets",
  requireClientAuth,
  multer(multerConfig).single("attachment"),
  async (req, res) => {
    try {
      const { title, description } = req.body;
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
          path: key, folder: process.env.AWS_BUCKET,
          type: mimetype, filename: originalname, size: size,
        });
      }
      const newTicket = await Ticket.create(ticketData);

      try {
        const project = await Project.findByPk(newTicket.projectId);
        const projectName = project ? project.name : 'Não especificado';

        const emailHtml = await ejs.renderFile(
          path.join(__dirname, 'views/emails/newTicketNotification.ejs'),
          { 
            clientName: req.user.name,
            clientEmail: req.user.email,
            ticketTitle: newTicket.title,
            ticketDescription: newTicket.description,
            projectName: projectName
          }
        );

        await MailService.sendMail(
          process.env.ADMIN_EMAIL,
          `Novo Chamado: ${newTicket.title} [Projeto: ${projectName}]`,
          emailHtml
        );
      } catch (mailError) {
        console.error("Falha ao enviar email de notificação do novo chamado:", mailError);
      }

      res.redirect("/portal/tickets");
    } catch (error) {
      console.error("Erro ao criar chamado:", error);
      res.status(500).render("new-ticket", {
          message: null,
          error: `Erro ao criar chamado: ${error.message}`,
          user: req.user
      });
    }
  }
);

app.use((req, res, next) => {
  res.status(404).render('404');
});

app.use((err, req, res, next) => {
  console.error("ERRO GERAL CAPTURADO:", err.stack);
  res.status(500).render('500');
});

const startServer = async () => {
  MailService.initialize();
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`🚀 Servidor a todo vapor!`);
    console.log(`AdminJS está rodando em http://localhost:${port}/admin`);
    console.log(`Portal do Cliente em http://localhost:${port}/portal`);
  });
}

startServer();