import "dotenv/config";
import "./database";

import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import AdminJSSequelize from "@adminjs/sequelize";
import express from "express";
import session from "express-session";
import path from "path";
import passport from "./config/passport";
import MailService from "./services/mail";
import portalRoutes from './routes/portal.routes';

import UsersResource from "./resources/UsersResource";
import ProjectsResource from "./resources/ProjectsResource";
import TasksResource from "./resources/TasksResource";
import User from "./models/user";
import ClientsResource from "./resources/ClientsResource";
import TicketsResource from "./resources/TicketsResource";
import CommentsResource from "./resources/CommentsResource";
import locale from "./locales";
import theme from "./theme";

AdminJS.registerAdapter(AdminJSSequelize);

const app = express();

app.use("/public", express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const adminJS = new AdminJS({
  databases: [],
  rootPath: "/admin",
  dashboard: { component: AdminJS.bundle("./components/Dashboard/index"), },
  resources: [ UsersResource, ProjectsResource, TasksResource, ClientsResource, TicketsResource, CommentsResource, ],
  branding: {
    companyName: "Kakau Tech", logo: "/public/kakau.webp",
    favicon: "/public/favicon.webp", softwareBrothers: false, theme,
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
  // <<-- MUDANÇA: Atualizado o caminho da view -->>
  res.render("admin/admin-login", { error });
});

app.post("/admin/login", async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const adminUser = await User.findOne({ where: { email } });
    if (!adminUser) {
      return res.render("admin/admin-login", { error: "Email ou senha inválidos." });
    }
    const isPasswordCorrect = await adminUser.checkPassword(password);
    if (isPasswordCorrect) {
      req.login(adminUser, (err) => {
        if (err) { return next(err); }
        req.session.adminUser = adminUser.toJSON();
        req.session.save((saveErr) => {
          if (saveErr) { return next(saveErr); }
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
  passport.authenticate("google-admin", { failureRedirect: "/admin/login", failureMessage: true, }),
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

app.use(portalRoutes);

app.use((req, res, next) => {
  const context = req.originalUrl.startsWith('/admin') ? 'admin' : 'portal';
  // <<-- MUDANÇA: Atualizado o caminho da view -->>
  res.status(404).render('errors/404', { context });
});

app.use((err, req, res, next) => {
  console.error("ERRO GERAL CAPTURADO:", err.stack);
  // <<-- MUDANÇA: Atualizado o caminho da view -->>
  res.status(500).render('errors/500');
});

const startServer = async () => {
  await MailService.initialize();
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`🚀 Servidor a todo vapor!`);
    console.log(`AdminJS está rodando em http://localhost:${port}/admin`);
    console.log(`Portal do Cliente em http://localhost:${port}/portal`);
  });
}

startServer();