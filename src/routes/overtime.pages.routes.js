import express from "express";
import ejs from "ejs";
import path from "path";
import { Op } from "sequelize";

import OvertimeRecord from "../models/overtimerecord.js";
import User from "../models/user.js";
import Project from "../models/project.js";
import Ticket from "../models/ticket.js";
import { ensureHolidaysForYear, formatMinutes } from "../services/overtime.js";
import { hasAdminPermission } from "../services/auth.js";

const router = express.Router();

// ============================================================
// Middleware de autenticação
// ============================================================
const checkAdminAuth = (req, res, next) => {
  if (req.session.adminUser || (req.isAuthenticated && req.isAuthenticated() && req.user)) {
    return next();
  }
  return res.redirect("/admin/login");
};

// ============================================================
// Recursos do sidebar — replicado do admin.pages.routes.js
// ============================================================
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

// ============================================================
// Helper: renderiza view dentro do layout admin
// ============================================================
function renderWithLayout(res, viewName, data) {
  const viewsDir   = path.join(process.cwd(), "src", "views");
  const viewFile   = path.join(viewsDir, "admin", `${viewName}.ejs`);
  const layoutFile = path.join(viewsDir, "admin", "admin-layout.ejs");

  ejs.renderFile(viewFile, data, (err, body) => {
    if (err) {
      console.error("Erro ao renderizar view:", err);
      return res.status(500).send("Erro interno ao renderizar página.");
    }
    ejs.renderFile(layoutFile, { ...data, body }, (err2, html) => {
      if (err2) {
        console.error("Erro ao renderizar layout:", err2);
        return res.status(500).send("Erro interno ao renderizar layout.");
      }
      res.send(html);
    });
  });
}

// ============================================================
// GET /admin/overtime — Visão geral
//   Admin: vê todos os funcionários
//   Outros: redireciona para a própria página
// ============================================================
router.get("/", checkAdminAuth, async (req, res) => {
  try {
    const adminUser = req.session.adminUser || req.user;
    const isAdmin   = hasAdminPermission(adminUser);

    // Usuário não-admin é redirecionado para a própria página de HE
    if (!isAdmin) {
      return res.redirect(`/admin/overtime/user/${adminUser.id}`);
    }

    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    await ensureHolidaysForYear(year);

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth   = new Date(year, month, 0, 23, 59, 59);

    const records = await OvertimeRecord.findAll({
      where: { started_at: { [Op.between]: [startOfMonth, endOfMonth] } },
      include: [
        { model: User,    as: "User",    attributes: ["id", "name"] },
        { model: Project, as: "Project", attributes: ["id", "name"] },
        { model: Ticket,  as: "Ticket",  attributes: ["id", "title"] },
      ],
      order: [["started_at", "ASC"]],
    });

    // Agrupa por usuário
    const byUser = {};
    for (const r of records) {
      const uid = r.userId;
      if (!byUser[uid]) {
        byUser[uid] = { user: r.User, totalMinutes: 0, records: [] };
      }
      byUser[uid].totalMinutes += r.overtime_minutes;
      byUser[uid].records.push({
        ...r.toJSON(),
        overtime_formatted: formatMinutes(r.overtime_minutes),
      });
    }

    const summary = Object.values(byUser).map((u) => ({
      ...u,
      total_formatted: formatMinutes(u.totalMinutes),
    }));

    renderWithLayout(res, "admin-overtime", {
      adminUser,
      sidebarResources: getSidebarResources(adminUser),
      activeMenu: "overtime",
      pageTitle: "Horas Extras",
      summary,
      year,
      month,
    });
  } catch (error) {
    console.error("Erro na listagem de HE:", error);
    res.status(500).send("Erro interno.");
  }
});

// ============================================================
// GET /admin/overtime/user/:userId — HE de um funcionário
//   Admin: pode ver qualquer usuário
//   Outros: só podem ver a própria página
// ============================================================
router.get("/user/:userId", checkAdminAuth, async (req, res) => {
  try {
    const adminUser     = req.session.adminUser || req.user;
    const isAdmin       = hasAdminPermission(adminUser);
    const requestedId   = parseInt(req.params.userId);

    // Não-admin só acessa a própria página
    if (!isAdmin && adminUser.id !== requestedId) {
      return res.redirect(`/admin/overtime/user/${adminUser.id}`);
    }

    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    await ensureHolidaysForYear(year);

    const user = await User.findByPk(requestedId);
    if (!user) return res.status(404).send("Usuário não encontrado.");

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth   = new Date(year, month, 0, 23, 59, 59);

    const records = await OvertimeRecord.findAll({
      where: {
        userId: requestedId,
        started_at: { [Op.between]: [startOfMonth, endOfMonth] },
      },
      include: [
        { model: Project, as: "Project", attributes: ["id", "name"] },
        { model: Ticket,  as: "Ticket",  attributes: ["id", "title"] },
      ],
      order: [["started_at", "ASC"]],
    });

    const totalMinutes = records.reduce((sum, r) => sum + (r.overtime_minutes || 0), 0);

    const projects = await Project.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });

    renderWithLayout(res, "admin-overtime-user", {
      adminUser,
      isAdmin,
      sidebarResources: getSidebarResources(adminUser),
      activeMenu: "overtime",
      pageTitle: `Horas Extras — ${user.name}`,
      targetUser: user.toJSON(),
      records: records.map((r) => ({
        ...r.toJSON(),
        overtime_formatted: formatMinutes(r.overtime_minutes),
      })),
      totalMinutes,
      total_formatted: formatMinutes(totalMinutes),
      year,
      month,
      projects,
    });
  } catch (error) {
    console.error("Erro na view de HE do usuário:", error);
    res.status(500).send("Erro interno.");
  }
});

export default router;
