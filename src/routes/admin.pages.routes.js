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
import Group from "../models/group.js";
import { hasAdminPermission, hasManagerPermission } from "../services/auth.js";
import { Op } from "sequelize";

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
// Resource configs for rendering
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
    groupFiltered: true,
    groupFilterField: "id",
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
        { value: "done", label: "Concluído" },
      ],
    },
    includes: [
      { model: User, as: "User", attributes: ["id", "name"] },
      { model: Project, as: "Project", attributes: ["id", "name"] },
    ],
    foreignKeys: {},
    hasAttachment: true,
    groupFiltered: true,
    groupFilterField: "project_id",
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
    groupFiltered: true,
    groupFilterField: "projectId",
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
    groupFiltered: true,
    groupFilterField: "projectId",
  },
  groups: {
    model: Group,
    label: "Grupos",
    icon: "🗂",
    searchField: "name",
    listFields: ["id", "name", "slug", "description", "status", "createdAt"],
    editFields: ["name", "slug", "description", "status"],
    fieldLabels: { id: "ID", name: "Nome", slug: "Slug", description: "Descrição", status: "Status", createdAt: "Criado Em" },
    fieldOptions: {
      status: [
        { value: "active", label: "Ativo" },
        { value: "archived", label: "Arquivado" },
      ],
    },
    includes: [],
    foreignKeys: {},
    listPermission: "admin",
    writePermission: "admin",
    isGroupResource: true, // flag para renderizar página especial
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
      // "Grupos" tem link fixo na seção "Gestão" do menu (admin-layout.ejs),
      // então não deve ser duplicado aqui na lista dinâmica de "Recursos".
      if (config.isGroupResource) return false;
      if (config.listPermission === "admin") return hasAdminPermission(currentUser);
      return true;
    })
    .map(([key, config]) => ({
      id: key,
      label: config.label,
      icon: config.icon,
    }));
}

// ============================================================
// Helper: carregar grupos do usuário atual
// ============================================================
async function loadUserGroups(currentUser) {
  if (hasAdminPermission(currentUser)) {
    // Admin vê todos os grupos ativos
    return await Group.findAll({ where: { status: "active" }, order: [["name", "ASC"]] });
  }
  // Outros usuários: apenas seus grupos
  const user = await User.findByPk(currentUser.id, {
    include: [{ model: Group, as: "Groups", where: { status: "active" }, required: false, order: [["name", "ASC"]] }],
  });
  return user ? (user.Groups || []) : [];
}

// ============================================================
// Helper: resolver IDs de projetos acessíveis ao usuário/grupo
// ============================================================
async function getGroupProjectIds(req) {
  const currentUser = req.session.adminUser || req.user;

  // Admin vendo "todos" (sem grupo ativo)
  if (hasAdminPermission(currentUser) && !req.session.activeGroup) {
    return null; // sem restrição
  }

  const activeGroup = req.session.activeGroup;

  if (activeGroup) {
    const group = await Group.findByPk(activeGroup, {
      include: [{ model: Project, as: "Projects", attributes: ["id"] }],
    });
    if (!group) return [];
    return group.Projects.map((p) => p.id);
  }

  // Usuário não-admin sem grupo ativo: projetos de todos seus grupos combinados
  if (!hasAdminPermission(currentUser)) {
    const user = await User.findByPk(currentUser.id, {
      include: [{ model: Group, as: "Groups", include: [{ model: Project, as: "Projects", attributes: ["id"] }] }],
    });
    if (!user) return [];
    const projectIds = [];
    for (const g of user.Groups || []) {
      for (const p of g.Projects || []) {
        if (!projectIds.includes(p.id)) projectIds.push(p.id);
      }
    }
    return projectIds;
  }

  return null;
}

// Helper: load FK options for forms
async function loadForeignKeys(config, record = null) {
  const fks = {};
  for (const inc of (config.includes || [])) {
    const nameField = inc.attributes?.[1] || "name";
    // Usuários arquivados não devem aparecer como opção para novos
    // vínculos (responsável de projeto/tarefa/chamado, etc.) — apenas
    // usuários ativos entram na lista.
    const isUserModel = inc.model.name === "User";

    const records = await inc.model.findAll({
      attributes: ["id", nameField],
      where: isUserModel ? { status: "active" } : undefined,
      limit: 500,
      order: [[nameField, "ASC"]],
    });
    const options = records.map((r) => ({
      value: r.id,
      label: r[nameField] || `#${r.id}`,
    }));

    const modelName = inc.model.name.toLowerCase();
    const matchingFields = config.editFields.filter((f) => {
      const fLower = f.toLowerCase().replace(/_/g, "");
      return fLower.includes(modelName) || fLower === modelName + "id";
    });

    for (const f of matchingFields) {
      let fieldOptions = options;

      // Se estamos editando um registro que já aponta para um usuário
      // arquivado (fora da lista de ativos), mantemos essa opção visível
      // e marcada — senão o campo apareceria vazio no formulário e, ao
      // salvar sem tocar nele, o responsável seria removido sem querer.
      if (isUserModel && record) {
        const currentValue = record[f];
        const jaIncluido = currentValue != null && options.some((o) => o.value == currentValue);
        if (currentValue != null && !jaIncluido) {
          const arquivado = await inc.model.findByPk(currentValue, { attributes: ["id", nameField] });
          if (arquivado) {
            fieldOptions = [
              ...options,
              { value: arquivado.id, label: `${arquivado[nameField] || `#${arquivado.id}`} (arquivado)` },
            ];
          }
        }
      }

      fks[f] = fieldOptions;
    }
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
// Helper: montar dados base passados para todas as views
// ============================================================
async function baseViewData(req) {
  const adminUser = req.session.adminUser || req.user;
  const userGroups = await loadUserGroups(adminUser);
  const activeGroup = req.session.activeGroup || null;
  const activeGroupObj = activeGroup ? userGroups.find((g) => g.id == activeGroup) || null : null;

  return {
    adminUser,
    sidebarResources: getSidebarResources(adminUser),
    userGroups: userGroups.map((g) => g.toJSON ? g.toJSON() : g),
    activeGroup,
    activeGroupObj: activeGroupObj ? (activeGroupObj.toJSON ? activeGroupObj.toJSON() : activeGroupObj) : null,
    showGroupSelector: userGroups.length > 1 || hasAdminPermission(adminUser),
  };
}

// ============================================================
// ROTAS DE PÁGINAS
// ============================================================

// Dashboard
router.get("/", checkAdminAuth, async (req, res) => {
  const base = await baseViewData(req);
  renderWithLayout(res, "admin-dashboard.ejs", {
    ...base,
    activeMenu: "dashboard",
  });
});

// List
router.get("/resources/:resource", checkAdminAuth, async (req, res) => {
  try {
    const { resource } = req.params;
    const config = resourceConfig[resource];
    if (!config) return res.status(404).render("errors/404", { context: "admin" });

    const base = await baseViewData(req);
    const adminUser = base.adminUser;

    if (config.listPermission === "admin" && !hasAdminPermission(adminUser)) {
      return res.status(403).send("Acesso negado.");
    }

    // Página especial de gerenciamento de grupos
    if (config.isGroupResource) {
      const groups = await Group.findAll({
        include: [
          { model: User, as: "Users", attributes: ["id", "name"] },
          { model: Project, as: "Projects", attributes: ["id", "name"] },
        ],
        order: [["name", "ASC"]],
      });
      const allUsers = await User.findAll({ attributes: ["id", "name", "email"], where: { status: "active" }, order: [["name", "ASC"]] });
      const allProjects = await Project.findAll({ attributes: ["id", "name"], where: { status: "active" }, order: [["name", "ASC"]] });

      return renderWithLayout(res, "admin-groups.ejs", {
        ...base,
        activeMenu: "groups",
        groups: groups.map((g) => g.toJSON()),
        allUsers: allUsers.map((u) => u.toJSON()),
        allProjects: allProjects.map((p) => p.toJSON()),
      });
    }

    // Check kanban view
    const hasStatuses = config.fieldOptions && config.fieldOptions.status && config.fieldOptions.status.length > 0;
    const viewMode = req.query.view || (hasStatuses ? "kanban" : "list");

    // Filtro de grupo para queries
    const projectIds = config.groupFiltered ? await getGroupProjectIds(req) : null;

    if (viewMode === "kanban" && hasStatuses) {
      const where = {};
      if (config.groupFiltered && projectIds !== null) {
        if (projectIds.length === 0) {
          return renderWithLayout(res, "admin-kanban.ejs", {
            ...base,
            activeMenu: resource,
            resourceId: resource,
            resourceLabel: config.label,
            listFields: config.listFields,
            editFields: config.editFields,
            fieldLabels: config.fieldLabels || {},
            fieldOptions: config.fieldOptions || {},
            records: [],
            total: 0,
          });
        }
        where[config.groupFilterField] = { [Op.in]: projectIds };
      }

      const { count, rows } = await config.model.findAndCountAll({
        where,
        include: config.includes || [],
        order: config.defaultSort || [["id", "DESC"]],
      });

      const records = rows.map((r) => r.toJSON());

      return renderWithLayout(res, "admin-kanban.ejs", {
        ...base,
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

    // List mode
    const page = parseInt(req.query.page) || 1;
    const perPage = 20;
    const offset = (page - 1) * perPage;

    const where = {};
    const currentFilters = {};
    Object.keys(req.query).forEach((key) => {
      if (key.startsWith("filter.") && req.query[key]) {
        where[key.replace("filter.", "")] = req.query[key];
        currentFilters[key] = req.query[key];
      }
    });

    if (config.groupFiltered && projectIds !== null) {
      if (projectIds.length === 0) {
        return renderWithLayout(res, "admin-list.ejs", {
          ...base,
          activeMenu: resource,
          resourceId: resource,
          resourceLabel: config.label,
          listFields: config.listFields,
          editFields: config.editFields,
          fieldLabels: config.fieldLabels || {},
          fieldOptions: config.fieldOptions || {},
          records: [],
          total: 0,
          currentPage: 1,
          perPage,
          totalPages: 0,
          currentFilters: {},
          filterQuery: "",
          flashSuccess: null,
        });
      }
      where[config.groupFilterField] = { [Op.in]: projectIds };
    }

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
    const flashSuccess = req.query.success || null;

    renderWithLayout(res, "admin-list.ejs", {
      ...base,
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

    const base = await baseViewData(req);
    const foreignKeys = await loadForeignKeys(config);

    renderWithLayout(res, "admin-form.ejs", {
      ...base,
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

    const base = await baseViewData(req);

    renderWithLayout(res, "admin-show.ejs", {
      ...base,
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

    const base = await baseViewData(req);
    const foreignKeys = await loadForeignKeys(config, record);

    renderWithLayout(res, "admin-form.ejs", {
      ...base,
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

    const base = await baseViewData(req);
    const showAssignButton = base.adminUser && json.userId !== base.adminUser.id && json.status === "open";

    renderWithLayout(res, "admin-ticket-show.ejs", {
      ...base,
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
