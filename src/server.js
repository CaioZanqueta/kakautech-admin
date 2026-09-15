import "dotenv/config";
import "./database/index.js";

import express from "express";
import helmet from "helmet";
import session from "express-session";
import path from "path";
import fs from 'fs';
import passport from "./config/passport.js";
import MailService from "./services/mail.js";
import portalRoutes from "./routes/portal.routes.js";
import apiRoutes from "./routes/api.routes.js";
import adminApiRoutes from "./routes/admin.api.routes.js";
import adminPagesRoutes from "./routes/admin.pages.routes.js";
import overtimeApiRoutes from "./routes/overtime.api.routes.js";
import overtimePagesRoutes from "./routes/overtime.pages.routes.js";
import oncallApiRoutes from "./routes/oncall.api.routes.js";
import oncallPagesRoutes from "./routes/oncall.pages.routes.js";

import User    from "./models/user.js";
import Project from "./models/project.js";
import Ticket  from "./models/ticket.js";
import TimeLog from "./models/timelog.js";
import { loginLimiter, apiLimiter } from './config/limiters.js';
import { Op } from 'sequelize';
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import ejs from 'ejs';

// ============================================================
// Validação de variáveis de ambiente críticas na inicialização
// O servidor não sobe se SESSION_SECRET não estiver definido
// ============================================================
if (!process.env.SECRET || process.env.SECRET.length < 32) {
  console.error('ERRO FATAL: A variável de ambiente SECRET não está definida ou é muito curta (mínimo 32 chars). O servidor não pode iniciar de forma segura.');
  process.exit(1);
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const isProd   = process.env.NODE_ENV === 'production';

const app = express();
app.set('trust proxy', 1);

// ============================================================
// Helmet — Headers de segurança HTTP
// ============================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:    ["'self'"],
        scriptSrc:     ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.gstatic.com", "https://www.google.com", "https://apis.google.com", "https://fonts.googleapis.com"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc:      ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://www.gstatic.com"],
        fontSrc:       ["'self'", "https://fonts.gstatic.com", "https://www.gstatic.com"],
        imgSrc:        ["'self'", "data:", "https:"],
        connectSrc:    ["'self'"],
        frameSrc:      ["'none'"],
        objectSrc:     ["'none'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    hidePoweredBy: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

app.use("/public", express.static("public"));
app.use("/uploads", express.static("uploads"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// Sessão segura
// ============================================================
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge:   24 * 60 * 60 * 1000,
      httpOnly: true,           // cookie inacessível via JS
      secure:   isProd,         // HTTPS-only em produção
      sameSite: 'lax',          // proteção CSRF básica
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ============================================================
// Health check — usado por load balancer e monitoramento
// ============================================================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// API pública (tickets, comentários, relatórios)
// ============================================================
app.use('/api', apiLimiter, apiRoutes);

app.get("/", (req, res) => {
  if (req.session.adminUser || req.isAuthenticated()) {
    return res.redirect("/admin");
  }
  if (req.session.clientUser) {
    return res.redirect("/portal");
  }
  res.render("home");
});

// ============================================================
// LOGIN ADMIN
// ============================================================
app.get("/admin/login", (req, res) => {
  const messages = req.session.messages || [];
  req.session.messages = [];
  const error = messages.length > 0 ? messages[0] : null;
  res.render("admin/admin-login", { error });
});

app.post("/admin/login", loginLimiter, async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const adminUser = await User.findOne({ where: { email } });
    if (!adminUser) {
      return res.render("admin/admin-login", {
        error: "Email ou senha inválidos.",
      });
    }
    const isPasswordCorrect = await adminUser.checkPassword(password);
    if (isPasswordCorrect) {
      req.login(adminUser, (err) => {
        if (err) return next(err);
        req.session.adminUser = adminUser.toJSON();
        req.session.activeGroup = null;
        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          return res.redirect("/admin");
        });
      });
    } else {
      res.render("admin/admin-login", { error: "Email ou senha inválidos." });
    }
  } catch (error) {
    console.error("ERRO GERAL NO LOGIN:", error);
    next(error);
  }
});

// ============================================================
// SELETOR DE GRUPO
// ============================================================
app.post("/admin/set-group", (req, res) => {
  const isAuthenticated = req.session.adminUser || req.isAuthenticated();
  if (!isAuthenticated) return res.status(401).json({ message: "Não autenticado." });

  const { groupId } = req.body;
  req.session.activeGroup = (!groupId || groupId === "null" || groupId === "") ? null : parseInt(groupId, 10);

  req.session.save((err) => {
    if (err) return res.status(500).json({ message: "Erro ao salvar sessão." });
    if (req.headers.accept && req.headers.accept.includes("text/html")) {
      return res.redirect(req.body.redirect || req.headers.referer || "/admin");
    }
    res.json({ ok: true, activeGroup: req.session.activeGroup });
  });
});

// ============================================================
// RELATÓRIOS DE PROJETO
// ============================================================
app.get('/admin/projects/:projectId/reports', async (req, res) => {
  const isAuthenticated = req.session.adminUser || req.isAuthenticated();
  if (!isAuthenticated) return res.redirect('/admin/login');

  const { projectId } = req.params;
  const project = await Project.findByPk(projectId);
  if (!project) return res.status(404).render("errors/404", { context: "admin" });

  res.render('admin/project-reports', {
    project: project.toJSON(),
    adminUser: req.session.adminUser || req.user,
    user: req.session.adminUser || req.user,
  });
});

app.get('/admin/projects/:projectId/reports/download/:filename', async (req, res) => {
  const isAuthenticated = req.session.adminUser || req.isAuthenticated();
  if (!isAuthenticated) return res.redirect('/admin/login');

  try {
    const { projectId } = req.params;
    const { reportType, period, format } = req.query;

    const project = await Project.findByPk(projectId);
    if (!project) return res.status(404).send('Projeto não encontrado.');
    if (!['csv', 'xlsx', 'pdf'].includes(format)) return res.status(400).send('Formato inválido.');

    let start, end = new Date();
    const now = new Date();
    end.setHours(23, 59, 59, 999);
    switch (period) {
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'current_quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'current_year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }
    start.setHours(0, 0, 0, 0);

    let reportResult = {};
    if (reportType === 'hours') {
      const totalSeconds = await TimeLog.sum('seconds_spent', {
        where: { createdAt: { [Op.between]: [start, end] } },
        include: [{ model: Ticket, attributes: [], where: { projectId }, required: true }],
      });
      reportResult = { totalHours: ((totalSeconds || 0) / 3600).toFixed(2) };
    }
    if (reportType === 'tickets') {
      const tickets = await Ticket.findAll({
        where: { projectId, createdAt: { [Op.between]: [start, end] } },
        include: [{ model: Client, as: 'Client', attributes: ['name'] }],
        order: [['createdAt', 'DESC']],
      });
      reportResult = { tickets: tickets.map(t => t.toJSON()) };
    }

    const projectSlug = project.name.toLowerCase().replace(/\s+/g, '_');
    const responsePayload = {
      ...reportResult,
      project: project.name,
      period: { start: start.toLocaleDateString('pt-BR'), end: end.toLocaleDateString('pt-BR') },
      type: reportType,
    };

    const reportsDir = path.join(process.cwd(), 'public', 'reports');
    try {
      const files = fs.readdirSync(reportsDir);
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      files.forEach(f => {
        const filePath = path.join(reportsDir, f);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < fiveMinAgo) fs.unlinkSync(filePath);
      });
    } catch(e) {}

    const baseFilename = `relatorio_${reportType}_${projectSlug}`;

    if (format === 'csv') {
      const json2csvParser = new Parser();
      let csv;
      if (reportType === 'hours') {
        csv = json2csvParser.parse([{ Projeto: project.name, 'Período Início': responsePayload.period.start, 'Período Fim': responsePayload.period.end, 'Total Horas': responsePayload.totalHours }]);
      } else {
        csv = json2csvParser.parse((responsePayload.tickets || []).map(t => ({ ID: t.id, Título: t.title, 'Criado Por': t.Client?.name || 'N/D', Status: t.status, Prioridade: t.priority, Data: new Date(t.createdAt).toLocaleDateString('pt-BR') })));
      }
      const filePath = path.join(reportsDir, `${baseFilename}.csv`);
      fs.writeFileSync(filePath, csv, 'utf-8');
      return res.redirect(`/public/reports/${baseFilename}.csv`);
    }

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Relatório');
      if (reportType === 'hours') {
        ws.columns = [{ header: 'Projeto', key: 'p', width: 30 }, { header: 'Início', key: 'i', width: 20 }, { header: 'Fim', key: 'f', width: 20 }, { header: 'Horas', key: 'h', width: 20 }];
        ws.addRow({ p: project.name, i: responsePayload.period.start, f: responsePayload.period.end, h: parseFloat(responsePayload.totalHours) });
      } else {
        ws.columns = [{ header: 'ID', key: 'id', width: 10 }, { header: 'Título', key: 't', width: 40 }, { header: 'Criado Por', key: 'c', width: 25 }, { header: 'Status', key: 's', width: 15 }, { header: 'Prioridade', key: 'p', width: 15 }, { header: 'Data', key: 'd', width: 20 }];
        (responsePayload.tickets || []).forEach(t => ws.addRow({ id: t.id, t: t.title, c: t.Client?.name || 'N/D', s: t.status, p: t.priority, d: new Date(t.createdAt).toLocaleDateString('pt-BR') }));
      }
      const filePath = path.join(reportsDir, `${baseFilename}.xlsx`);
      await workbook.xlsx.writeFile(filePath);
      return res.redirect(`/public/reports/${baseFilename}.xlsx`);
    }

    if (format === 'pdf') {
      const html = await ejs.renderFile(path.join(__dirname, 'views/reports/pdf-template.ejs'), responsePayload);
      const pBrowser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const pPage = await pBrowser.newPage();
      await pPage.goto(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`, { waitUntil: 'networkidle0' });
      const pdfBuffer = await pPage.pdf({ format: 'A4', printBackground: true });
      await pBrowser.close();
      const filePath = path.join(reportsDir, `${baseFilename}.pdf`);
      fs.writeFileSync(filePath, pdfBuffer);
      return res.redirect(`/public/reports/${baseFilename}.pdf`);
    }
  } catch (error) {
    console.error('ERRO AO GERAR DOWNLOAD DE RELATÓRIO:', error);
    return res.status(500).send('Erro ao gerar relatório.');
  }
});

// ============================================================
// HORAS EXTRAS — API e páginas
// ============================================================
app.use('/api/admin/overtime', overtimeApiRoutes);
app.use('/admin/overtime', overtimePagesRoutes);
app.use("/admin/api/oncall", oncallApiRoutes);
app.use("/admin", oncallPagesRoutes);

// ============================================================
// ADMIN API e PÁGINAS
// ============================================================
app.use('/admin/api', adminApiRoutes);
app.use('/admin', adminPagesRoutes);

// ============================================================
// AUTH GOOGLE (Admin)
// ============================================================
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
      req.session.activeGroup = null;
      req.session.save(() => res.redirect("/admin"));
    } else {
      res.redirect("/admin/login");
    }
  }
);

// ============================================================
// AUTH MICROSOFT (Admin)
// Suporta tanto @kakautech.com quanto @kakau.com.br
// ============================================================
app.get("/admin/auth/microsoft", passport.authenticate("microsoft-admin"));
app.get(
  "/admin/auth/microsoft/callback",
  passport.authenticate("microsoft-admin", {
    failureRedirect: "/admin/login",
    failureMessage: true,
  }),
  (req, res, next) => {
    if (req.user) {
      req.session.adminUser = req.user.toJSON();
      req.session.activeGroup = null;
      req.session.save(() => res.redirect("/admin"));
    } else {
      res.redirect("/admin/login");
    }
  }
);

app.get("/admin/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    delete req.session.adminUser;
    req.session.destroy(() => res.redirect("/admin/login"));
  });
});

// ============================================================
// PORTAL DO CLIENTE
// ============================================================
app.use(portalRoutes);

// Fix #4: rotas /portal/privacy e /portal/terms movidas para portal.routes.js
// para garantir que sejam resolvidas ANTES do catch-all do Express

// ============================================================
// ERROR PAGES
// ============================================================
app.use((req, res, next) => {
  const context = req.originalUrl.startsWith("/admin") ? "admin" : "portal";
  res.status(404).render("errors/404", { context });
});

app.use((err, req, res, next) => {
  console.error("ERRO GERAL CAPTURADO:", err.stack);
  res.status(500).render("errors/500");
});

// ============================================================
// Tratamento de erros não capturados — evita queda silenciosa
// ============================================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise não tratada:', promise, 'Motivo:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Exceção não capturada:', err);
  // Não derruba o processo em produção — apenas loga
});

// ============================================================
// START SERVER
// ============================================================
const startServer = async () => {
  await MailService.initialize();
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Servidor iniciado na porta ${port}`);
    console.log(`Admin em ${BASE_URL}/admin`);
    console.log(`Portal do Cliente em ${BASE_URL}/portal`);
    console.log(`Modo: ${isProd ? 'produção' : 'desenvolvimento'}`);
  });
};

startServer();
