import express from "express";
import ejs from "ejs";
import path from "path";
import { hasAdminPermission } from "../services/auth.js";
import User from "../models/user.js";
import Group from "../models/group.js";

var router = express.Router();

// ─── Auth ─────────────────────────────────────────────────────
var isAuthenticatedAdmin = function(req, res, next) {
  if (
    (req.session && req.session.adminUser) ||
    (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.role)
  ) return next();
  return res.redirect("/admin/login");
};

// ─── Sidebar de recursos — replicado do admin.pages.routes.js ─
const resourceConfig = {
  users:    { label: "Usuários",  icon: "👤", listPermission: "admin" },
  projects: { label: "Projetos",  icon: "📁" },
  tasks:    { label: "Tarefas",   icon: "✅" },
  clients:  { label: "Clientes",  icon: "🏢", listPermission: "admin" },
  tickets:  { label: "Chamados",  icon: "🎫" },
};

function getSidebarResources(currentUser) {
  return Object.entries(resourceConfig)
    .filter(([, cfg]) => {
      if (cfg.listPermission === "admin") return hasAdminPermission(currentUser);
      return true;
    })
    .map(([key, cfg]) => ({ id: key, label: cfg.label, icon: cfg.icon }));
}

async function loadUserGroups(currentUser) {
  if (hasAdminPermission(currentUser)) {
    return await Group.findAll({ where: { status: "active" }, order: [["name", "ASC"]] });
  }
  var user = await User.findByPk(currentUser.id, {
    include: [{ model: Group, as: "Groups", where: { status: "active" }, required: false, order: [["name", "ASC"]] }],
  });
  return user ? (user.Groups || []) : [];
}

// ─── Helper: renderiza view dentro do layout admin ─────────────
function renderWithLayout(res, viewName, data) {
  var viewsDir   = path.join(process.cwd(), "src", "views");
  var viewFile   = path.join(viewsDir, "admin", viewName + ".ejs");
  var layoutFile = path.join(viewsDir, "admin", "admin-layout.ejs");

  ejs.renderFile(viewFile, data, function(err, body) {
    if (err) {
      console.error("Erro ao renderizar view:", err);
      return res.status(500).send("Erro interno ao renderizar página.");
    }
    ejs.renderFile(layoutFile, Object.assign({}, data, { body: body }), function(err2, html) {
      if (err2) {
        console.error("Erro ao renderizar layout:", err2);
        return res.status(500).send("Erro interno ao renderizar layout.");
      }
      res.send(html);
    });
  });
}

// ─── GET /admin/plantonistas ──────────────────────────────────
router.get("/plantonistas", isAuthenticatedAdmin, async function(req, res) {
  try {
    var currentUser = (req.session && req.session.adminUser) || req.user;
    var groups = await Group.findAll({
      where: { status: "active" },
      order: [["name", "ASC"]],
    });

    // Usuários ativos para o modal de criação manual
    var allUsers = await User.findAll({
      where: { status: "active" },
      attributes: ["id", "name", "email", "phone"],
      order: [["name", "ASC"]],
    });

    var userGroups    = await loadUserGroups(currentUser);
    var activeGroup   = (req.session && req.session.activeGroup) || null;
    var activeGroupObj = activeGroup ? (userGroups.find(function(g) { return g.id == activeGroup; }) || null) : null;

    renderWithLayout(res, "admin-oncall", {
      pageTitle:   "Plantão de Suporte",
      activeMenu:  "plantonistas",
      currentUser,
      groups,
      allUsers,
      isAdmin: hasAdminPermission(currentUser),
      adminUser: currentUser,
      sidebarResources: getSidebarResources(currentUser),
      userGroups: userGroups.map(function(g) { return g.toJSON ? g.toJSON() : g; }),
      activeGroup,
      activeGroupObj: activeGroupObj ? (activeGroupObj.toJSON ? activeGroupObj.toJSON() : activeGroupObj) : null,
      showGroupSelector: userGroups.length > 1 || hasAdminPermission(currentUser),
      reqUrl: req.originalUrl,
    });
  } catch (err) {
    console.error("[oncall pages] /plantonistas", err);
    res.status(500).render("errors/500");
  }
});

export default router;
