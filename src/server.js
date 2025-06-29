import "dotenv/config";
import "./database";

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

import UsersResource from "./resources/UsersResource";
import ProjectsResource from "./resources/ProjectsResource";
import TasksResource from "./resources/TasksResource";
import User from "./models/user";
import ClientsResource from "./resources/ClientsResource";
import TicketsResource from "./resources/TicketsResource";
import Client from "./models/client";
import Ticket from "./models/ticket";

import locale from "./locales";
import theme from "./theme";

console.log(">>>> SERVIDOR SENDO INICIADO COM A VERSÃO MAIS RECENTE DO CÓDIGO <<<<");

AdminJS.registerAdapter(AdminJSSequelize);

const app = express();

// =================================================================
// === INÍCIO: MIDDLEWARE DE DIAGNÓSTICO GLOBAL                  ===
// =================================================================
// Este middleware irá logar CADA requisição que chegar no servidor.
// Ele deve ser o PRIMEIRO app.use() a ser declarado.
app.use((req, res, next) => {
  console.log(`[LOG GERAL] Requisição recebida: ${req.method} ${req.originalUrl}`);
  next();
});
// =================================================================
// === FIM: MIDDLEWARE DE DIAGNÓSTICO GLOBAL                     ===
// =================================================================


// Configurações básicas do Express
app.use("/public", express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Instância do AdminJS
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

// Middlewares Globais
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 dia
  })
);
app.use(passport.initialize());
app.use(passport.session());

// =================================================================
// === LÓGICA DE AUTENTICAÇÃO PERSONALIZADA PARA ADMINJS (COM LOGS) ==
// =================================================================

const adminRouter = AdminJSExpress.buildRouter(adminJS);

// Middleware de verificação de login do admin
const checkAdminAuth = (req, res, next) => {
  if (req.isAuthenticated() && req.user instanceof User) {
    return next();
  }
  res.redirect("/admin/login");
};

// Aplicação do roteador e middleware para o AdminJS
app.use(
  adminJS.options.rootPath,
  (req, res, next) => {
    if (
      req.originalUrl.startsWith("/admin/login") ||
      req.originalUrl.startsWith("/admin/auth")
    ) {
      return next();
    }
    return checkAdminAuth(req, res, next);
  },
  adminRouter
);

// Rota para renderizar a página de login do admin
app.get("/admin/login", (req, res) => {
  const messages = req.session.messages || [];
  req.session.messages = [];
  const error = messages.length > 0 ? messages[0] : null;
  res.render("admin-login", { error });
});

// Rota para login tradicional (email/senha) do admin (COM LOGS DE DEPURAÇÃO)
app.post("/admin/login", async (req, res, next) => {
  console.log("--- LOG 1: Rota POST /admin/login foi acionada. ---");
  const { email, password } = req.body;
  const adminUser = await User.findOne({ where: { email } });

  if (!adminUser) {
    console.log("--- LOG 2.1: Usuário não encontrado no banco de dados. ---");
    return res.render("admin-login", { error: "Email ou senha inválidos." });
  }

  console.log("--- LOG 2: Usuário encontrado:", adminUser.email, "---");
  const isPasswordCorrect = await adminUser.checkPassword(password);

  if (isPasswordCorrect) {
    console.log("--- LOG 3: Senha está correta. Tentando chamar req.login(). ---");
    // Usamos req.login() do Passport para registrar a sessão corretamente
    req.login(adminUser, (err) => {
      if (err) {
        console.error(
          "--- LOG 4.1 (ERRO): Erro dentro do callback de req.login():",
          err,
          "---"
        );
        return next(err);
      }
      console.log(
        "--- LOG 4: Callback de req.login() executado com sucesso. Redirecionando... ---"
      );
      return res.redirect("/admin");
    });
  } else {
    console.log("--- LOG 3.1: Senha incorreta. ---");
    res.render("admin-login", { error: "Email ou senha inválidos." });
  }
});

// Rotas de autenticação social para o admin
app.get("/admin/auth/google", passport.authenticate("google-admin"));

// Callback do Google Admin (SIMPLIFICADO)
app.get(
  "/admin/auth/google/callback",
  passport.authenticate("google-admin", {
    failureRedirect: "/admin/login",
    failureMessage: true,
  }),
  (req, res) => {
    // O passport.authenticate já chama req.login() internamente, então só precisamos redirecionar.
    res.redirect("/admin");
  }
);

// Rota de logout para o admin (CORRIGIDO)
app.get("/admin/logout", (req, res, next) => {
  // Usamos req.logout() do Passport
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
});

// =================================================================
// === ROTAS DO PORTAL DO CLIENTE                                ===
// =================================================================
const requireClientAuth = (req, res, next) => {
  // ATUALIZADO: Usando o sistema do Passport também para o cliente
  if (req.isAuthenticated() && req.user instanceof Client) {
    next();
  } else {
    res.redirect("/portal/login");
  }
};

// Autenticação social para o PORTAL DO CLIENTE
app.get(
  "/auth/google",
  passport.authenticate("google-client", { scope: ["profile", "email"] })
);
app.get(
  "/auth/google/callback",
  passport.authenticate("google-client", { failureRedirect: "/portal/login" }),
  (req, res) => {
    req.login(req.user, (err) => { // Alinhando com o fluxo do passport
        if (err) { return next(err); }
        res.redirect("/portal/tickets/new");
    });
  }
);
app.get("/auth/microsoft", passport.authenticate("microsoft-client"));
app.get(
  "/auth/microsoft/callback",
  passport.authenticate("microsoft-client", {
    failureRedirect: "/portal/login",
  }),
  (req, res) => {
     req.login(req.user, (err) => { // Alinhando com o fluxo do passport
        if (err) { return next(err); }
        res.redirect("/portal/tickets/new");
    });
  }
);

// Rotas normais do portal
app.get("/portal", (req, res) => {
  if (req.isAuthenticated() && req.user instanceof Client) {
    res.redirect("/portal/tickets/new");
  } else {
    res.redirect("/portal/login");
  }
});
app.get("/portal/login", (req, res) => {
  res.render("client-login", { error: null });
});
// Login tradicional do cliente AGORA USANDO PASSPORT
app.post("/portal/login", (req, res, next) => {
  // Para o login do cliente, precisamos de uma estratégia 'local-client' no passport.js
  passport.authenticate("local-client", (err, client, info) => {
    if (err) { return next(err); }
    if (!client) {
      return res.render("client-login", { error: "Email ou senha inválidos." });
    }
    req.login(client, (err) => {
      if (err) { return next(err); }
      return res.redirect("/portal/tickets/new");
    });
  })(req, res, next);
});
app.get("/portal/register", (req, res) => {
  res.render("client-register", { error: null });
});
app.post("/portal/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const existingClient = await Client.findOne({ where: { email } });
    if (existingClient) {
      return res.render("client-register", {
        error: "Este e-mail já está cadastrado. Tente fazer o login.",
      });
    }
    const newClient = await Client.create({ name, email, password });
    req.login(newClient, (err) => {
      if (err) { return next(err); }
      return res.redirect("/portal/tickets/new");
    });
  } catch (error) {
    console.error("Erro no cadastro do cliente:", error);
    res.render("client-register", {
      error: "Ocorreu um erro inesperado. Tente novamente.",
    });
  }
});

// Logout do cliente
app.get("/portal/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    req.session.destroy(() => {
      res.redirect("/portal/login");
    });
  });
});

// Rota de download
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
});

// Rotas de tickets
app.get("/portal/tickets/new", requireClientAuth, (req, res) => {
  res.render("new-ticket", { message: null, error: null });
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
        clientId: req.user.id, // Usando req.user.id
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
      await Ticket.create(ticketData);
      res.render("new-ticket", {
        message: "Chamado aberto com sucesso!",
        error: null,
      });
    } catch (error) {
      console.error("Erro ao criar chamado:", error);
      res
        .status(500)
        .render("new-ticket", {
          message: null,
          error: `Erro ao criar chamado: ${error.message}`,
        });
    }
  }
);

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`AdminJS está rodando em http://localhost:${port}/admin`);
  console.log(`Portal do Cliente em http://localhost:${port}/portal`);
});