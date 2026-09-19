import "dotenv/config";
import "./database/index.js";
import express from "express";
import helmet from "helmet";
import session from "express-session";
import path from "path";
import passport from "./config/passport.js";
import MailService from "./services/mail.js";
import portalRoutes from "./routes/portal.routes.js";
import apiRoutes from "./routes/api.routes.js";
import adminApiRoutes from "./routes/admin.api.routes.js";
import adminPagesRoutes from "./routes/admin.pages.routes.js";
import taskManagementRoutes from "./routes/task-management.routes.js";
import worklogReportRoutes from "./routes/worklog-report.routes.js";
import overtimeApiRoutes from "./routes/overtime.api.routes.js";
import overtimePagesRoutes from "./routes/overtime.pages.routes.js";
import oncallApiRoutes from "./routes/oncall.api.routes.js";
import oncallPagesRoutes from "./routes/oncall.pages.routes.js";
import User from "./models/user.js";
import { loginLimiter, apiLimiter } from "./config/limiters.js";

if (!process.env.SECRET || process.env.SECRET.length < 32) {
  console.error("ERRO FATAL: SECRET ausente ou curta.");
  process.exit(1);
}

const app = express();
const isProd = process.env.NODE_ENV === "production";
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://www.gstatic.com",
          "https://www.google.com",
          "https://apis.google.com",
        ],
        // Compatibilidade temporária com handlers legados dos templates EJS.
        // Mantida separada de script-src para não ampliar origens externas.
        // Novas telas devem continuar usando addEventListener.
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use("/public", express.static("public"));
app.use("/uploads", express.static("uploads"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 86400000,
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

app.use("/api", apiLimiter, apiRoutes);
app.get("/", (req, res) =>
  req.session.adminUser || req.isAuthenticated()
    ? res.redirect("/admin")
    : req.session.clientUser
      ? res.redirect("/portal")
      : res.render("home")
);

app.get("/admin/login", (req, res) => {
  const messages = req.session.messages || [];
  req.session.messages = [];
  res.render("admin/admin-login", { error: messages[0] || null });
});

app.post("/admin/login", loginLimiter, async (req, res, next) => {
  try {
    const user = await User.findOne({ where: { email: req.body.email } });
    if (!user || !(await user.checkPassword(req.body.password))) {
      return res.render("admin/admin-login", { error: "Email ou senha inválidos." });
    }
    return req.login(user, (error) => {
      if (error) return next(error);
      req.session.adminUser = user.toJSON();
      req.session.activeGroup = null;
      return req.session.save((sessionError) =>
        sessionError ? next(sessionError) : res.redirect("/admin")
      );
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/admin/set-group", (req, res) => {
  if (!req.session.adminUser && !req.isAuthenticated()) return res.sendStatus(401);
  req.session.activeGroup =
    !req.body.groupId || req.body.groupId === "null"
      ? null
      : parseInt(req.body.groupId, 10);
  return req.session.save((error) =>
    error
      ? res.sendStatus(500)
      : res.redirect(req.body.redirect || req.headers.referer || "/admin")
  );
});

app.use("/api/admin/overtime", overtimeApiRoutes);
app.use("/admin/overtime", overtimePagesRoutes);
app.use("/admin/api/oncall", oncallApiRoutes);
app.use("/admin", oncallPagesRoutes);
app.use("/admin/api/tasks-management", taskManagementRoutes);
app.use("/admin/reports/worklogs", worklogReportRoutes);
app.use("/admin/api", adminApiRoutes);
app.use("/admin", adminPagesRoutes);

app.get("/admin/auth/google", passport.authenticate("google-admin"));
app.get(
  "/admin/auth/google/callback",
  passport.authenticate("google-admin", {
    failureRedirect: "/admin/login",
    failureMessage: true,
  }),
  (req, res) => {
    req.session.adminUser = req.user.toJSON();
    req.session.activeGroup = null;
    req.session.save(() => res.redirect("/admin"));
  }
);
app.get("/admin/auth/microsoft", passport.authenticate("microsoft-admin"));
app.get(
  "/admin/auth/microsoft/callback",
  passport.authenticate("microsoft-admin", {
    failureRedirect: "/admin/login",
    failureMessage: true,
  }),
  (req, res) => {
    req.session.adminUser = req.user.toJSON();
    req.session.activeGroup = null;
    req.session.save(() => res.redirect("/admin"));
  }
);
app.get("/admin/logout", (req, res, next) =>
  req.logout((error) => {
    if (error) return next(error);
    return req.session.destroy(() => res.redirect("/admin/login"));
  })
);

app.use(portalRoutes);
app.use((req, res) =>
  res
    .status(404)
    .render("errors/404", {
      context: req.originalUrl.startsWith("/admin") ? "admin" : "portal",
    })
);
app.use((error, req, res, next) => {
  console.error("Erro:", isProd ? error.message : error.stack);
  res.status(500).render("errors/500");
});

async function start() {
  await MailService.initialize();
  app.listen(process.env.PORT || 5000, () =>
    console.log(`Servidor iniciado: ${BASE_URL}`)
  );
}

start();
