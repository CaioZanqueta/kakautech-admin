import express from "express";
import ejs from "ejs";
import path from "path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import credentials from "../config/credentials.js";

import User from "../models/user.js";
import Project from "../models/project.js";
import Task from "../models/task.js";
import Client from "../models/client.js";
import Ticket from "../models/ticket.js";
import Comment from "../models/comment.js";
import ActivityLog from "../models/activitylog.js";
import { hasAdminPermission, hasManagerPermission } from "../services/auth.js";

const router = express.Router();

const s3 = new S3Client({
  region: credentials.region,
  credentials: {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  },
});

async function generateSignedUrl(record) {
  if (record.path && record.folder) {
    try {
      const command = new GetObjectCommand({ Bucket: record.folder, Key: record.path });
      return await getSignedUrl(s3, command, { expiresIn: 3600 });
    } catch (e) {
      return null;
    }
  }
  return null;
}

// ============================================================
// Resource configs for rendering (shared with admin.api.routes.js)
// ============================================================
const resourceConfig = {
  users: {
    model: User,
    label: "Usuários",
    icon: "👤",
    searchField: "name",
    listFields: ["id", "initials", "name", "email", "role", "status", "createdAt"],
    editFields: ["name", "email", "password", "role", "status"],
    fieldLabels: { id: "ID", initials: "Iniciais", name: "Nome", email: "Email", role: "Cargo", status: "Status", createdAt: "Criado Em", updatedAt: "Atualizado Em", password: "Senha" },
    fieldOptions: {
      role: [
        { value: "admin", label: "Administrador" },
        { value: "manager", label: "Gerente" },
        { value: "developer", label: "Desenvolvedor" },
      ],
      status: [
        { value: "active", label: "Ativo" },
        { value: "archived", label: "Arquivado" },
      ],
    },
    includes: [],
    foreignKeys: {},
    listPermission: "admin",
  },
  projects: {
    model: Project,
    label: "Projetos",
    icon: "📁",
    searchField: "name",
    listFields: ["id", "name", "support_hours_limit", "status", "createdAt"],
    editFields: ["name", "description", "support_hours_limit", "user_id", "status"],
    fieldLabels: { id: "ID", name: "Nome", description: "Descrição", support_hours_limit: "Limite de Horas", status: "Status", createdAt: "Criado Em", userId: "Responsável" },
    fieldOptions: {
      status: [
        { value: "active", label: "Ativo" },
        { value: "archived", label: "Arquivado" },
      ],
    },
    includes: [{ model: User, as: "User", attributes: ["id", "name"] }],
    foreignKeys: {},
    writePermission: "manager",
  },
  tasks: {
    model: Task,
    label: "Tarefas",
    icon: "✅",
    searchField: "title",
    listFields: ["id", "title", "due_date", "order", "status", "userId", "createdAt"],
    editFields: ["title", "description", "due_date", "order", "status", "project_id", "user_id"],
    fieldLabels: { id: "ID", title: "Título", description: "Descrição", due_date: "Prazo", order: "Prioridade", status: "Status", userId: "Responsável", projectId: "Projeto", createdAt: "Criado Em" },
    fieldOptions: {
      order: [
        { value: "Low", label: "Baixa" },
        { value: "Medium", label: "Média" },
        { value: "High", label: "Alta" },
      ],
      status: [
        { value: "backlog", label: "Backlog" },
        { value: "doing", label: "Em Execução" },
        { value: "done", label: "Pronto" },
        { value: "approved", label: "Aprovado" },
        { value: "rejected", label: "Rejeitado" },
      ],
    },
    includes: [
      { model: User, as: "User", attributes: ["id", "name"] },
      { model: Project, as: "Project", attributes: ["id", "name"] },
    ],
    foreignKeys: {},
    hasAttachment: true,
  },
  clients: {
    model: Client,
    label: "Clientes",
    icon: "🏢",
    searchField: "name",
    listFields: ["id", "name", "email", "projectId", "status"],
    editFields: ["name", "email", "projectId", "status", "password"],
    fieldLabels: { id: "ID", name: "Nome", email: "Email", projectId: "Projeto", project_id: "Projeto", status: "Status", password: "Senha" },
    fieldOptions: {
      status: [
        { value: "pending", label: "Pendente" },
        { value: "active", label: "Ativo" },
        { value: "inactive", label: "Inativo" },
      ],
    },
    includes: [{ model: Project, as: "Project", attributes: ["id", "name"] }],
    foreignKeys: {},
    listPermission: "admin",
  },
  tickets: {
    model: Ticket,
    label: "Chamados",
    icon: "🎫",
    searchField: "title",
    listFields: ["id", "title", "type", "status", "priority", "clientId", "userId", "createdAt"],
    editFields: ["title", "description", "type", "category", "urgency", "impact", "status", "clientId", "projectId", "userId"],
    fieldLabels: { 
      id: "ID", 
      title: "Título", 
      description: "Descrição", 
      type: "Tipo",
      category: "Categoria",
      urgency: "Urgência",
      impact: "Impacto",
      status: "Status", 
      priority: "Prioridade", 
      clientId: "Cliente", 
      projectId: "Projeto", 
      userId: "Responsável", 
      createdAt: "Criado Em" 
    },
    fieldOptions: {
      type: [
        { value: "incident", label: "Incidente" },
        { value: "service_request", label: "Requisição de Serviço" },
      ],
      urgency: [
        { value: "low", label: "Baixa" },
        { value: "medium", label: "Média" },
        { value: "high", label: "Alta" },
      ],
      impact: [
        { value: "low", label: "Baixo" },
        { value: "medium", label: "Médio" },
        { value: "high", label: "Alto" },
      ],
      status: [
        { value: "open", label: "Aberto" },
        { value: "pending", label: "Pendente" },
        { value: "in_progress", label: "Em Andamento" },
        { value: "closed", label: "Fechado" },
      ],
      priority: [
        { value: "low", label: "Baixa" },
        { value: "medium", label: "Média" },
        { value: "high", label: "Alta" },
      ],
    },
    includes: [
      { model: Client, as: "Client", attributes: ["id", "name"] },
      { model: User, as: "User", attributes: ["id", "name"] },
      { model: Project, as: "Project", attributes: ["id", "name"] },
    ],
    foreignKeys: {},
    defaultSort: [["createdAt", "DESC"]],
    writePermission: "manager",
    hasAttachment: true,
  },
};

// ============================================================
// Middleware: autenticação admin para páginas
// ============================================================
const checkAdminAuth = (req, res, next) => {
  if (req.session.adminUser) return next();
  if (req.isAuthenticated() && req.user && req.user.role) return next();
  return res.redirect("/admin/login");
};

// ============================================================
// Helper: sidebar resources list
// ============================================================
function getSidebarResources(currentUser) {
  return Object.entries(resourceConfig)
    .filter(([, config]) => {
      if (config.listPermission === "admin") return hasAdminPermission(currentUser);
      return true;
    })
    .map(([key, config]) => ({
      id: key,
      label: config.label,
      icon: config.icon,
    }));
}

// Helper: load FK options for forms
async function loadForeignKeys(config) {
  const fks = {};
  for (const inc of (config.includes || [])) {
    const nameField = inc.attributes?.[1] || "name";
    const records = await inc.model.findAll({
      attributes: ["id", nameField],
      limit: 500,
    });
    const options = records.map((r) => ({
      value: r.id,
      label: r[nameField] || `#${r.id}`,
    }));

    // Match FK fields in editFields
    const modelName = inc.model.name.toLowerCase();
    config.editFields.forEach((f) => {
      const fLower = f.toLowerCase().replace(/_/g, "");
      if (fLower.includes(modelName) || fLower === modelName + "id") {
        fks[f] = options;
      }
    });
  }
  return fks;
}

// ============================================================
// Helper: render page with layout
// ============================================================
function renderWithLayout(res, viewFile, data) {
  const viewPath = path.join(__dirname, "../views/admin", viewFile);
  ejs.renderFile(viewPath, data, (err, body) => {
    if (err) {
      console.error("Erro ao renderizar view:", err);
      return res.status(500).send("Erro interno.");
    }
    const layoutPath = path.join(__dirname, "../views/admin/admin-layout.ejs");
    ejs.renderFile(layoutPath, { ...data, body }, (err2, html) => {
      if (err2) {
        console.error("Erro ao renderizar layout:", err2);
        return res.status(500).send("Erro interno.");
      }
      res.send(html);
    });
  });
}

// ============================================================
// ROTAS DE PÁGINAS
// ============================================================

// Dashboard
router.get("/", checkAdminAuth, (req, res) => {
  const adminUser = req.session.adminUser || req.user;
  renderWithLayout(res, "admin-dashboard.ejs", {
    adminUser,
    sidebarResources: getSidebarResources(adminUser),
    activeMenu: "dashboard",
  });
});

// List
router.get("/resources/:resource", checkAdminAuth, async (req, res) => {
  try {
    const { resource } = req.params;
    const config = resourceConfig[resource];
    if (!config) return res.status(404).render("errors/404", { context: "admin" });

    const adminUser = req.session.adminUser || req.user;
    if (config.listPermission === "admin" && !hasAdminPermission(adminUser)) {
      return res.status(403).send("Acesso negado.");
    }

    // Check if kanban view is requested
    const hasStatuses = config.fieldOptions && config.fieldOptions.status && config.fieldOptions.status.length > 0;
    const viewMode = req.query.view || (hasStatuses ? "kanban" : "list");

    if (viewMode === "kanban" && hasStatuses) {
      // Kanban mode: load ALL records (no pagination)
      const { count, rows } = await config.model.findAndCountAll({
        include: config.includes || [],
        order: config.defaultSort || [["id", "DESC"]],
      });

      const records = rows.map((r) => r.toJSON());

      return renderWithLayout(res, "admin-kanban.ejs", {
        adminUser,
        sidebarResources: getSidebarResources(adminUser),
        activeMenu: resource,
        resourceId: resource,
        resourceLabel: config.label,
        listFields: config.listFields,
        editFields: config.editFields,
        fieldLabels: config.fieldLabels || {},
        fieldOptions: config.fieldOptions || {},
        records,
        total: count,
      });
    }

    // List mode (default)
    const page = parseInt(req.query.page) || 1;
    const perPage = 20;
    const offset = (page - 1) * perPage;

    // Build filters
    const where = {};
    const currentFilters = {};
    Object.keys(req.query).forEach((key) => {
      if (key.startsWith("filter.") && req.query[key]) {
        where[key.replace("filter.", "")] = req.query[key];
        currentFilters[key] = req.query[key];
      }
    });

    // Build filter query string for pagination links
    let filterQuery = "";
    Object.entries(currentFilters).forEach(([key, val]) => {
      filterQuery += `&${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
    });

    const { count, rows } = await config.model.findAndCountAll({
      where,
      include: config.includes || [],
      order: config.defaultSort || [["id", "DESC"]],
      limit: perPage,
      offset,
    });

    const records = rows.map((r) => r.toJSON());

    // Flash message
    const flashSuccess = req.query.success || null;

    renderWithLayout(res, "admin-list.ejs", {
      adminUser,
      sidebarResources: getSidebarResources(adminUser),
      activeMenu: resource,
      resourceId: resource,
      resourceLabel: config.label,
      listFields: config.listFields,
      editFields: config.editFields,
      fieldLabels: config.fieldLabels || {},
      fieldOptions: config.fieldOptions || {},
      records,
      total: count,
      currentPage: page,
      perPage,
      totalPages: Math.ceil(count / perPage),
      currentFilters,
      filterQuery,
      flashSuccess,
    });
  } catch (error) {
    console.error("Erro na listagem:", error);
    res.status(500).render("errors/500");
  }
});

// New (form)
router.get("/resources/:resource/new", checkAdminAuth, async (req, res) => {
  try {
    const { resource } = req.params;
    const config = resourceConfig[resource];
    if (!config || config.editFields.length === 0) return res.status(404).render("errors/404", { context: "admin" });

    const adminUser = req.session.adminUser || req.user;
    const foreignKeys = await loadForeignKeys(config);

    renderWithLayout(res, "admin-form.ejs", {
      adminUser,
      sidebarResources: getSidebarResources(adminUser),
      activeMenu: resource,
      resourceId: resource,
      resourceLabel: config.label,
      editFields: config.editFields,
      fieldLabels: config.fieldLabels || {},
      fieldOptions: config.fieldOptions || {},
      foreignKeys,
      hasAttachment: config.hasAttachment || false,
      isEdit: false,
      record: null,
    });
  } catch (error) {
    console.error("Erro no formulário:", error);
    res.status(500).render("errors/500");
  }
});

// Show (detail)
router.get("/resources/:resource/:id", checkAdminAuth, async (req, res) => {
  try {
    const { resource, id } = req.params;
    const config = resourceConfig[resource];
    if (!config) return res.status(404).render("errors/404", { context: "admin" });

    const record = await config.model.findByPk(id, {
      include: config.includes || [],
    });
    if (!record) return res.status(404).render("errors/404", { context: "admin" });

    const json = record.toJSON();
    if (config.hasAttachment && json.path) {
      json.signedUrl = await generateSignedUrl(json);
    }

    const adminUser = req.session.adminUser || req.user;

    renderWithLayout(res, "admin-show.ejs", {
      adminUser,
      sidebarResources: getSidebarResources(adminUser),
      activeMenu: resource,
      resourceId: resource,
      resourceLabel: config.label,
      record: json,
      editFields: config.editFields,
      fieldLabels: config.fieldLabels || {},
      fieldOptions: config.fieldOptions || {},
    });
  } catch (error) {
    console.error("Erro na visualização:", error);
    res.status(500).render("errors/500");
  }
});

// Edit (form with data)
router.get("/resources/:resource/:id/edit", checkAdminAuth, async (req, res) => {
  try {
    const { resource, id } = req.params;
    const config = resourceConfig[resource];
    if (!config || config.editFields.length === 0) return res.status(404).render("errors/404", { context: "admin" });

    const record = await config.model.findByPk(id, {
      include: config.includes || [],
    });
    if (!record) return res.status(404).render("errors/404", { context: "admin" });

    const adminUser = req.session.adminUser || req.user;
    const foreignKeys = await loadForeignKeys(config);

    renderWithLayout(res, "admin-form.ejs", {
      adminUser,
      sidebarResources: getSidebarResources(adminUser),
      activeMenu: resource,
      resourceId: resource,
      resourceLabel: config.label,
      editFields: config.editFields,
      fieldLabels: config.fieldLabels || {},
      fieldOptions: config.fieldOptions || {},
      foreignKeys,
      hasAttachment: config.hasAttachment || false,
      isEdit: true,
      record: record.toJSON(),
    });
  } catch (error) {
    console.error("Erro no formulário de edição:", error);
    res.status(500).render("errors/500");
  }
});

// Custom Ticket Show
router.get("/resources/tickets/:id/show", checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findByPk(id, {
      include: [
        { model: Client, as: "Client", attributes: ["id", "name"] },
        { model: User, as: "User", attributes: ["id", "name"] },
        { model: Project, as: "Project", attributes: ["id", "name"] },
      ],
    });

    if (!ticket) return res.status(404).render("errors/404", { context: "admin" });

    const json = ticket.toJSON();
    if (json.path) {
      json.signedUrl = await generateSignedUrl(json);
    }

    const adminUser = req.session.adminUser || req.user;
    const showAssignButton = adminUser && json.userId !== adminUser.id && json.status === "open";

    renderWithLayout(res, "admin-ticket-show.ejs", {
      adminUser,
      sidebarResources: getSidebarResources(adminUser),
      activeMenu: "tickets",
      ticket: json,
      showAssignButton,
    });
  } catch (error) {
    console.error("Erro na visualização do ticket:", error);
    res.status(500).render("errors/500");
  }
});

export { checkAdminAuth };
export default router;
