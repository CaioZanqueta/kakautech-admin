import express from "express";
import multer from "multer";
import multerConfig from "../config/multer.js";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import credentials from "../config/credentials.js";
import ejs from "ejs";
import path from "path";

import User from "../models/user.js";
import Project from "../models/project.js";
import Task from "../models/task.js";
import Client from "../models/client.js";
import Ticket from "../models/ticket.js";
import Comment from "../models/comment.js";
import ActivityLog from "../models/activitylog.js";
import TimeLog from "../models/timelog.js";
import { hasAdminPermission, hasManagerPermission } from "../services/auth.js";
import MailService from "../services/mail.js";

const router = express.Router();
const upload = multer(multerConfig);

const s3 = new S3Client({
  region: credentials.region,
  credentials: {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  },
});

// ============================================================
// Middleware de autenticação admin
// ============================================================
const isAuthenticatedAdmin = (req, res, next) => {
  if (req.session.adminUser || (req.isAuthenticated() && req.user && req.user.role)) {
    return next();
  }
  return res.status(401).json({ message: "Não autenticado." });
};

// Middleware para checar permissão de admin
const requireAdmin = (req, res, next) => {
  const currentUser = req.session.adminUser || req.user;
  if (!hasAdminPermission(currentUser)) {
    return res.status(403).json({ message: "Acesso negado. Apenas administradores." });
  }
  return next();
};

// Middleware para checar permissão de manager+
const requireManager = (req, res, next) => {
  const currentUser = req.session.adminUser || req.user;
  if (!hasManagerPermission(currentUser)) {
    return res.status(403).json({ message: "Acesso negado. Apenas gerentes ou administradores." });
  }
  return next();
};

// ============================================================
// Helper: Gerar signed URL para S3
// ============================================================
async function generateSignedUrl(record) {
  if (record.path && record.folder) {
    try {
      const command = new GetObjectCommand({
        Bucket: record.folder,
        Key: record.path,
      });
      return await getSignedUrl(s3, command, { expiresIn: 3600 });
    } catch (e) {
      console.error("Erro ao gerar URL assinada:", e);
      return null;
    }
  }
  return null;
}

// ============================================================
// Helper: model map (resource name -> Sequelize model + config)
// ============================================================
const resourceConfig = {
  users: {
    model: User,
    label: "Usuários",
    searchField: "name",
    listFields: ["id", "initials", "name", "email", "role", "status", "createdAt", "updatedAt"],
    editFields: ["name", "email", "password", "role", "status"],
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
    listPermission: "admin",
    writePermission: "admin",
  },
  projects: {
    model: Project,
    label: "Projetos",
    searchField: "name",
    listFields: ["id", "name", "description", "support_hours_limit", "userId", "status", "createdAt", "updatedAt"],
    editFields: ["name", "description", "support_hours_limit", "user_id", "status"],
    fieldOptions: {
      status: [
        { value: "active", label: "Ativo" },
        { value: "archived", label: "Arquivado" },
      ],
    },
    includes: [{ model: User, attributes: ["id", "name"] }],
    writePermission: "manager",
  },
  tasks: {
    model: Task,
    label: "Tarefas",
    searchField: "title",
    listFields: ["id", "title", "due_date", "order", "status", "userId", "createdAt"],
    editFields: ["title", "description", "due_date", "order", "status", "project_id", "user_id"],
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
    hasAttachment: true,
  },
  clients: {
    model: Client,
    label: "Clientes",
    searchField: "name",
    listFields: ["id", "name", "email", "projectId", "status"],
    editFields: ["name", "email", "projectId", "status", "password"],
    fieldOptions: {
      status: [
        { value: "pending", label: "Pendente" },
        { value: "active", label: "Ativo" },
        { value: "inactive", label: "Inativo" },
      ],
    },
    includes: [{ model: Project, as: "Project", attributes: ["id", "name"] }],
    listPermission: "admin",
    writePermission: "admin",
  },
  tickets: {
    model: Ticket,
    label: "Chamados",
    searchField: "title",
    listFields: ["id", "title", "status", "priority", "clientId", "projectId", "userId", "createdAt"],
    editFields: ["title", "description", "type", "category", "urgency", "impact", "status", "clientId", "projectId", "userId"],
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
    },
    includes: [
      { model: Client, as: "Client", attributes: ["id", "name"] },
      { model: User, as: "User", attributes: ["id", "name"] },
      { model: Project, as: "Project", attributes: ["id", "name"] },
    ],
    defaultSort: [["createdAt", "DESC"]],
    writePermission: "manager",
    hasAttachment: true,
  },
  comments: {
    model: Comment,
    label: "Comentários",
    searchField: "content",
    listFields: ["id", "content", "ticket_id", "user_id", "client_id", "createdAt"],
    editFields: [],
    includes: [
      { model: Ticket, attributes: ["id", "title"] },
      { model: User, as: "User", attributes: ["id", "name"] },
      { model: Client, as: "Client", attributes: ["id", "name"] },
    ],
    hidden: true,
    writePermission: "manager",
  },
  "activity-logs": {
    model: ActivityLog,
    label: "Logs de Atividade",
    searchField: "description",
    listFields: ["id", "description", "ticketId", "userId", "createdAt"],
    editFields: [],
    includes: [
      { model: Ticket, attributes: ["id", "title"] },
      { model: User, as: "User", attributes: ["id", "name"] },
    ],
    hidden: true,
    writePermission: "manager",
  },
};

// ============================================================
// GET /me — Dados do admin logado
// ============================================================
router.get("/me", isAuthenticatedAdmin, (req, res) => {
  const adminUser = req.session.adminUser || req.user;
  res.json({
    id: adminUser.id,
    name: adminUser.name,
    email: adminUser.email,
    role: adminUser.role,
  });
});

// ============================================================
// GET /dashboard — Dados para o dashboard
// ============================================================
router.get("/dashboard", isAuthenticatedAdmin, async (req, res) => {
  try {
    const tasks = await Task.findAll({ attributes: ["id", "status"] });
    const tickets = await Ticket.findAll({ attributes: ["id", "status"] });

    // Agrupar tasks por status
    const tasksByStatus = {};
    tasks.forEach((t) => {
      tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
    });

    // Agrupar tickets por status
    const ticketsByStatus = {};
    tickets.forEach((t) => {
      ticketsByStatus[t.status] = (ticketsByStatus[t.status] || 0) + 1;
    });

    res.json({
      tasks: { total: tasks.length, byStatus: tasksByStatus },
      tickets: { total: tickets.length, byStatus: ticketsByStatus },
    });
  } catch (error) {
    console.error("Erro no dashboard:", error);
    res.status(500).json({ message: "Erro interno." });
  }
});

// ============================================================
// GET /resources — Lista de recursos disponíveis para sidebar
// ============================================================
router.get("/resources", isAuthenticatedAdmin, (req, res) => {
  const currentUser = req.session.adminUser || req.user;
  const resources = Object.entries(resourceConfig)
    .filter(([, config]) => !config.hidden)
    .filter(([, config]) => {
      if (config.listPermission === "admin") return hasAdminPermission(currentUser);
      return true;
    })
    .map(([key, config]) => ({
      id: key,
      label: config.label,
    }));
  res.json(resources);
});

// ============================================================
// GET /select-options/:resource — Opções para selects de FK
// ============================================================
router.get("/select-options/:resource", isAuthenticatedAdmin, async (req, res) => {
  try {
    const { resource } = req.params;
    const config = resourceConfig[resource];
    if (!config) return res.status(404).json({ message: "Recurso não encontrado." });

    const records = await config.model.findAll({
      attributes: ["id", config.searchField],
      order: [[config.searchField, "ASC"]],
      limit: 500,
    });

    res.json(records.map((r) => ({
      value: r.id,
      label: r[config.searchField] || `#${r.id}`,
    })));
  } catch (error) {
    console.error("Erro select-options:", error);
    res.status(500).json({ message: "Erro interno." });
  }
});

// ============================================================
// GET /:resource — Listagem com paginação, filtros, ordenação
// ============================================================
router.get("/:resource", isAuthenticatedAdmin, async (req, res) => {
  try {
    const { resource } = req.params;
    const config = resourceConfig[resource];
    if (!config) return res.status(404).json({ message: "Recurso não encontrado." });

    // Controle de acesso por listagem
    const currentUser = req.session.adminUser || req.user;
    if (config.listPermission === "admin" && !hasAdminPermission(currentUser)) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 20;
    const sortBy = req.query.sortBy || "id";
    const direction = req.query.direction || "DESC";
    const offset = (page - 1) * perPage;

    // Construir filtros
    const where = {};
    Object.keys(req.query).forEach((key) => {
      if (key.startsWith("filter.") && req.query[key]) {
        const field = key.replace("filter.", "");
        where[field] = req.query[key];
      }
    });

    const { count, rows } = await config.model.findAndCountAll({
      where,
      include: config.includes || [],
      order: config.defaultSort || [[sortBy, direction]],
      limit: perPage,
      offset,
    });

    // Gerar signed URLs se o recurso tem attachment
    const records = [];
    for (const row of rows) {
      const json = row.toJSON();
      if (config.hasAttachment && json.path) {
        json.signedUrl = await generateSignedUrl(json);
      }
      records.push(json);
    }

    res.json({
      records,
      total: count,
      page,
      perPage,
      totalPages: Math.ceil(count / perPage),
    });
  } catch (error) {
    console.error(`Erro ao listar ${req.params.resource}:`, error);
    res.status(500).json({ message: "Erro interno." });
  }
});

// ============================================================
// GET /:resource/:id — Visualização de registro
// ============================================================
router.get("/:resource/:id", isAuthenticatedAdmin, async (req, res) => {
  try {
    const { resource, id } = req.params;
    const config = resourceConfig[resource];
    if (!config) return res.status(404).json({ message: "Recurso não encontrado." });

    const record = await config.model.findByPk(id, {
      include: config.includes || [],
    });

    if (!record) return res.status(404).json({ message: "Registro não encontrado." });

    const json = record.toJSON();
    if (config.hasAttachment && json.path) {
      json.signedUrl = await generateSignedUrl(json);
    }

    res.json(json);
  } catch (error) {
    console.error(`Erro ao buscar ${req.params.resource}/${req.params.id}:`, error);
    res.status(500).json({ message: "Erro interno." });
  }
});

// ============================================================
// POST /:resource — Criação de registro
// ============================================================
router.post("/:resource", isAuthenticatedAdmin, upload.single("attachment"), async (req, res) => {
  try {
    const { resource } = req.params;
    const config = resourceConfig[resource];
    if (!config) return res.status(404).json({ message: "Recurso não encontrado." });

    // Controle de acesso por escrita
    const currentUser = req.session.adminUser || req.user;
    if (config.writePermission === "admin" && !hasAdminPermission(currentUser)) {
      return res.status(403).json({ message: "Acesso negado." });
    }
    if (config.writePermission === "manager" && !hasManagerPermission(currentUser)) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const data = { ...req.body };

    // Se tem upload de arquivo
    if (req.file) {
      data.path = req.file.key;
      data.folder = req.file.bucket;
      data.filename = req.file.originalname;
      data.size = req.file.size;

      // Se for Ticket, o campo 'type' é ENUM ITIL, então usamos 'file_type' para o anexo
      if (config.model.name === 'Ticket' || config.model.name === 'ticket') {
        data.file_type = req.file.contentType || req.file.mimetype;
      } else {
        data.type = req.file.contentType || req.file.mimetype;
      }
    }

    const record = await config.model.create(data);
    res.status(201).json(record.toJSON());
  } catch (error) {
    console.error(`Erro ao criar ${req.params.resource}:`, error);
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: "Erro de validação.",
        errors: error.errors.map((e) => e.message),
      });
    }
    res.status(500).json({ message: "Erro interno." });
  }
});

// ============================================================
// PUT /:resource/:id — Edição de registro
// ============================================================
router.put("/:resource/:id", isAuthenticatedAdmin, upload.single("attachment"), async (req, res) => {
  try {
    const { resource, id } = req.params;
    const config = resourceConfig[resource];
    if (!config) return res.status(404).json({ message: "Recurso não encontrado." });

    const currentUser = req.session.adminUser || req.user;
    if (config.writePermission === "admin" && !hasAdminPermission(currentUser)) {
      return res.status(403).json({ message: "Acesso negado." });
    }
    if (config.writePermission === "manager" && !hasManagerPermission(currentUser)) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const record = await config.model.findByPk(id);
    if (!record) return res.status(404).json({ message: "Registro não encontrado." });

    const data = { ...req.body };

    // Se tem upload de arquivo
    if (req.file) {
      data.path = req.file.key;
      data.folder = req.file.bucket;
      if (resource === "tickets") {
        data.file_type = req.file.contentType || req.file.mimetype;
      } else {
        data.type = req.file.contentType || req.file.mimetype;
      }
      data.filename = req.file.originalname;
      data.size = req.file.size;
    }

    // ========= HOOKS DE NEGÓCIO =========

    // CLIENTS: Email de aprovação quando status muda de pending -> active
    if (resource === "clients") {
      const originalStatus = record.status;
      const newStatus = data.status;
      if (originalStatus === "pending" && newStatus === "active") {
        try {
          const emailHtml = await ejs.renderFile(
            path.join(__dirname, "../views/emails/clientApproved.ejs"),
            { name: record.name }
          );
          await MailService.sendMail(record.email, "Sua conta foi aprovada!", emailHtml);
        } catch (mailError) {
          console.error("Falha ao enviar email de aprovação:", mailError);
        }
      }
    }

    // TICKETS: Activity log ao mudar status/responsável + email ao cliente
    if (resource === "tickets") {
      const statusTranslations = {
        open: "Aberto",
        pending: "Pendente",
        in_progress: "Em Andamento",
        closed: "Fechado",
      };

      const originalTicket = record.toJSON();

      // Log de mudança de status
      if (data.status && data.status !== originalTicket.status) {
        await ActivityLog.create({
          description: `Status alterado de "${statusTranslations[originalTicket.status] || originalTicket.status}" para "${statusTranslations[data.status] || data.status}"`,
          ticketId: id,
          userId: currentUser.id,
        });
      }

      // Log de mudança de responsável
      if (data.userId && data.userId != originalTicket.userId) {
        const oldUser = originalTicket.userId ? await User.findByPk(originalTicket.userId) : null;
        const newUser = data.userId ? await User.findByPk(data.userId) : null;
        const oldUserName = oldUser ? oldUser.name : "Ninguém";
        const newUserName = newUser ? newUser.name : "Ninguém";

        await ActivityLog.create({
          description: `Responsável alterado de "${oldUserName}" para "${newUserName}"`,
          ticketId: id,
          userId: currentUser.id,
        });
      }

      // Email de mudança de status
      if (data.status && data.status !== originalTicket.status) {
        if (!(originalTicket.status === "open" && data.status === "pending")) {
          try {
            const client = await Client.findByPk(originalTicket.clientId);
            if (client) {
              const emailHtml = await ejs.renderFile(
                path.join(__dirname, "../views/emails/ticketStatusChanged.ejs"),
                {
                  clientName: client.name,
                  ticketId: id,
                  ticketTitle: originalTicket.title,
                  oldStatus: statusTranslations[originalTicket.status] || originalTicket.status,
                  newStatus: statusTranslations[data.status] || data.status,
                  ticketUrl: `${process.env.BASE_URL || "http://localhost:5000"}/portal/tickets/${id}`,
                }
              );
              await MailService.sendMail(
                client.email,
                `O seu Chamado ${originalTicket.title} foi atualizado`,
                emailHtml
              );
            }
          } catch (mailError) {
            console.error("Falha ao enviar email de mudança de status:", mailError);
          }
        }
      }
    }

    await record.update(data);
    const updated = await config.model.findByPk(id, {
      include: config.includes || [],
    });
    res.json(updated.toJSON());
  } catch (error) {
    console.error(`Erro ao editar ${req.params.resource}/${req.params.id}:`, error);
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: "Erro de validação.",
        errors: error.errors.map((e) => e.message),
      });
    }
    res.status(500).json({ message: "Erro interno." });
  }
});

// ============================================================
// DELETE /:resource/:id — Exclusão de registro
// ============================================================
router.delete("/:resource/:id", isAuthenticatedAdmin, async (req, res) => {
  try {
    const { resource, id } = req.params;
    const config = resourceConfig[resource];
    if (!config) return res.status(404).json({ message: "Recurso não encontrado." });

    const currentUser = req.session.adminUser || req.user;
    if (config.writePermission === "admin" && !hasAdminPermission(currentUser)) {
      return res.status(403).json({ message: "Acesso negado." });
    }
    if (config.writePermission === "manager" && !hasManagerPermission(currentUser)) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const record = await config.model.findByPk(id);
    if (!record) return res.status(404).json({ message: "Registro não encontrado." });

    // Tentar deletar o arquivo do S3 se existir
    if (config.hasAttachment && record.path && record.folder) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: record.folder, Key: record.path }));
      } catch (s3Error) {
        console.error("Erro ao deletar arquivo no S3:", s3Error);
      }
    }

    await record.destroy();
    res.json({ message: "Registro apagado com sucesso." });
  } catch (error) {
    console.error(`Erro ao deletar ${req.params.resource}/${req.params.id}:`, error);
    res.status(500).json({ message: "Erro interno." });
  }
});

// ============================================================
// GET /tickets/:id/comments — Comentários de um ticket
// ============================================================
router.get("/tickets/:ticketId/comments", isAuthenticatedAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const comments = await Comment.findAll({
      where: { ticket_id: ticketId },
      include: [
        { model: User, attributes: ["id", "name"] },
        { model: Client, attributes: ["id", "name"] },
      ],
      order: [["createdAt", "ASC"]],
    });

    // Gerar signed URLs para anexos dos comentários
    const results = [];
    for (const comment of comments) {
      const json = comment.toJSON();
      if (json.path) {
        json.signedUrl = await generateSignedUrl(json);
      }
      results.push(json);
    }

    res.json(results);
  } catch (error) {
    console.error("Erro ao buscar comentários:", error);
    res.status(500).json({ message: "Erro interno." });
  }
});

// ============================================================
// GET /tickets/:id/activity-logs — Logs de atividade de um ticket
// ============================================================
router.get("/tickets/:ticketId/activity-logs", isAuthenticatedAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const logs = await ActivityLog.findAll({
      where: { ticketId },
      include: [{ model: User, attributes: ["id", "name"] }],
      order: [["createdAt", "DESC"]],
    });
    res.json(logs.map((l) => l.toJSON()));
  } catch (error) {
    console.error("Erro ao buscar logs de atividade:", error);
    res.status(500).json({ message: "Erro interno." });
  }
});

// ============================================================
// GET /resource-config/:resource — Metadata do recurso para formulários
// ============================================================
router.get("/resource-config/:resource", isAuthenticatedAdmin, async (req, res) => {
  try {
    const { resource } = req.params;
    const config = resourceConfig[resource];
    if (!config) return res.status(404).json({ message: "Recurso não encontrado." });

    // Listar FKs e buscar opções
    const foreignKeys = {};
    for (const inc of (config.includes || [])) {
      const modelName = inc.as || inc.model.name;
      const tableName = inc.model.tableName || inc.model.name.toLowerCase() + "s";
      const records = await inc.model.findAll({
        attributes: inc.attributes || ["id", "name"],
        limit: 500,
      });
      // Determinar o campo FK no editFields
      const possibleFkFields = config.editFields.filter(
        (f) =>
          f.toLowerCase().includes(modelName.toLowerCase()) ||
          f.toLowerCase().includes(inc.model.name.toLowerCase())
      );
      possibleFkFields.forEach((fkField) => {
        foreignKeys[fkField] = records.map((r) => ({
          value: r.id,
          label: r[inc.attributes?.[1] || "name"] || `#${r.id}`,
        }));
      });
    }

    res.json({
      label: config.label,
      listFields: config.listFields,
      editFields: config.editFields,
      fieldOptions: config.fieldOptions || {},
      foreignKeys,
      hasAttachment: config.hasAttachment || false,
    });
  } catch (error) {
    console.error("Erro resource-config:", error);
    res.status(500).json({ message: "Erro interno." });
  }
});

export { isAuthenticatedAdmin };
export default router;
