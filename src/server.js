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

// -> SDK DA AWS PARA DOWNLOAD SEGURO
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import credentials from "./config/credentials"; // -> Certifique-se que o caminho está correto

// Seus recursos e modelos existentes
import UsersResource from "./resources/UsersResource";
import ProjectsResource from "./resources/ProjectsResource";
import TasksResource from "./resources/TasksResource";
import User from "./models/user";

// Novos recursos e modelos
import ClientsResource from "./resources/ClientsResource";
import TicketsResource from "./resources/TicketsResource";
import Client from "./models/client";
import Ticket from "./models/ticket"; // -> Necessário para a nova rota

import locale from "./locales";
import theme from "./theme";

AdminJS.registerAdapter(AdminJSSequelize);

const app = express();

// Configurações básicas do Express (arquivos estáticos e views)
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

// 1. Roteador do AdminJS - DEVE VIR PRIMEIRO
const adminJsRouter = AdminJSExpress.buildAuthenticatedRouter(adminJS, {
  authenticate: async (email, password) => {
    const user = await User.findOne({ where: { email } });
    if (user && (await user.checkPassword(password))) {
      return user;
    }
    return false;
  },
  cookiePassword: process.env.SECRET,
});
app.use(adminJS.options.rootPath, adminJsRouter);

// 2. Middlewares Globais - VÊM DEPOIS DO ROTEADOR DO ADMINJS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// 3. ROTAS DO PORTAL DO CLIENTE E OUTRAS ROTAS
const requireClientAuth = (req, res, next) => {
  if (req.session.clientId) {
    next();
  } else {
    res.redirect("/portal/login");
  }
};

app.get("/portal", (req, res) => {
  if (req.session.clientId) {
    res.redirect("/portal/tickets/new");
  } else {
    res.redirect("/portal/login");
  }
});

app.get("/portal/login", (req, res) => {
  res.render("client-login", { error: null });
});

app.post("/portal/login", async (req, res) => {
  const { email, password } = req.body;
  const client = await Client.findOne({ where: { email } });
  if (client && (await client.checkPassword(password))) {
    req.session.clientId = client.id;
    res.redirect("/portal/tickets/new");
  } else {
    res.render("client-login", { error: "Email ou senha inválidos." });
  }
});

app.get("/portal/register", (req, res) => {
  res.render("client-register", { error: null });
});

app.post("/portal/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingClient = await Client.findOne({ where: { email } });
    if (existingClient) {
      return res.render("client-register", {
        error: "Este e-mail já está cadastrado. Tente fazer o login.",
      });
    }
    const newClient = await Client.create({ name, email, password });
    req.session.clientId = newClient.id;
    res.redirect("/portal/tickets/new");
  } catch (error) {
    console.error("Erro no cadastro do cliente:", error);
    res.render("client-register", {
      error: "Ocorreu um erro inesperado. Tente novamente.",
    });
  }
});

app.get("/portal/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/portal/login");
  });
});

// === NOVA ROTA DE DOWNLOAD SEGURO ADICIONADA AQUI ===
app.get('/portal/download/ticket/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const ticket = await Ticket.findByPk(recordId);

    if (!ticket || !ticket.path) {
      return res.status(404).send('Anexo não encontrado ou ticket inválido.');
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
    console.error('Erro ao gerar link de download:', error);
    res.status(500).send('Erro ao processar o download.');
  }
});


app.get("/portal/tickets/new", requireClientAuth, (req, res) => {
  res.render("new-ticket", { message: null, error: null });
});

app.post("/portal/tickets", requireClientAuth, multer(multerConfig).single('attachment'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const ticketData = {
        title,
        description,
        clientId: req.session.clientId,
        status: 'open',
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
    res.render("new-ticket", { message: "Chamado aberto com sucesso!", error: null });

  } catch (error) {
    console.error("Erro ao criar chamado:", error);
    res.status(500).render("new-ticket", { message: null, error: `Erro ao criar chamado: ${error.message}` });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`AdminJS está rodando em http://localhost:${port}/admin`);
  console.log(`Portal do Cliente em http://localhost:${port}/portal`);
});