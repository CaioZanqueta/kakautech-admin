import express from "express";
import { Op } from "sequelize";

import OvertimeRecord from "../models/overtimerecord.js";
import Holiday from "../models/holiday.js";
import User from "../models/user.js";
import Ticket from "../models/ticket.js";
import Project from "../models/project.js";
import {
  calcOvertimeMinutes,
  syncHolidays,
  ensureHolidaysForYear,
  formatMinutes,
} from "../services/overtime.js";

const router = express.Router();

// ============================================================
// Middleware de autenticação — replicado localmente para evitar
// conflito de módulos com Sucrase
// ============================================================
const isAuthenticatedAdmin = (req, res, next) => {
  if (req.session.adminUser || (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.role)) {
    return next();
  }
  return res.status(401).json({ message: "Não autenticado." });
};

// ============================================================
// GET /api/admin/overtime/:userId — Lista HE por mês
// Query: month (1-12), year (YYYY)
// ============================================================
router.get("/:userId", isAuthenticatedAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    await ensureHolidaysForYear(year);

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth   = new Date(year, month, 0, 23, 59, 59);

    const records = await OvertimeRecord.findAll({
      where: {
        userId,
        started_at: { [Op.between]: [startOfMonth, endOfMonth] },
      },
      include: [
        { model: Ticket,  as: "Ticket",  attributes: ["id", "title"] },
        { model: Project, as: "Project", attributes: ["id", "name"]  },
      ],
      order: [["started_at", "ASC"]],
    });

    const totalMinutes = records.reduce((sum, r) => sum + (r.overtime_minutes || 0), 0);

    res.json({
      records: records.map((r) => ({
        ...r.toJSON(),
        overtime_formatted: formatMinutes(r.overtime_minutes),
      })),
      total_minutes: totalMinutes,
      total_formatted: formatMinutes(totalMinutes),
    });
  } catch (error) {
    console.error("Erro ao listar horas extras:", error);
    res.status(500).json({ message: "Erro interno." });
  }
});

// ============================================================
// POST /api/admin/overtime — Registro manual de HE
// Body: { userId, ticketId?, projectId?, started_at, ended_at, description }
// ============================================================
router.post("/", isAuthenticatedAdmin, async (req, res) => {
  try {
    const { userId, ticketId, projectId, started_at, ended_at, description } = req.body;

    if (!userId || !started_at || !ended_at) {
      return res.status(400).json({ message: "userId, started_at e ended_at são obrigatórios." });
    }

    const start = new Date(started_at);
    const end   = new Date(ended_at);

    if (end <= start) {
      return res.status(400).json({ message: "ended_at deve ser posterior a started_at." });
    }

    await ensureHolidaysForYear(start.getFullYear());
    if (start.getFullYear() !== end.getFullYear()) {
      await ensureHolidaysForYear(end.getFullYear());
    }

    const overtimeMinutes = await calcOvertimeMinutes(start, end);

    if (overtimeMinutes === 0) {
      return res.status(400).json({
        message: "O período está inteiramente dentro do horário comercial. Nenhuma hora extra registrada.",
      });
    }

    const record = await OvertimeRecord.create({
      userId,
      ticketId:         ticketId  || null,
      projectId:        projectId || null,
      started_at:       start,
      ended_at:         end,
      overtime_minutes: overtimeMinutes,
      description:      description || null,
      source:           "manual",
    });

    res.status(201).json({
      ...record.toJSON(),
      overtime_formatted: formatMinutes(overtimeMinutes),
    });
  } catch (error) {
    console.error("Erro ao criar hora extra:", error);
    res.status(500).json({ message: "Erro interno." });
  }
});

// ============================================================
// DELETE /api/admin/overtime/:id — Remove um registro
// ============================================================
router.delete("/:id", isAuthenticatedAdmin, async (req, res) => {
  try {
    const record = await OvertimeRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: "Registro não encontrado." });

    await record.destroy();
    res.json({ message: "Registro removido com sucesso." });
  } catch (error) {
    console.error("Erro ao remover hora extra:", error);
    res.status(500).json({ message: "Erro interno." });
  }
});

// ============================================================
// POST /api/admin/overtime/holidays/sync — Sincroniza feriados
// Body: { year }
// ============================================================
router.post("/holidays/sync", isAuthenticatedAdmin, async (req, res) => {
  try {
    const year = parseInt(req.body.year) || new Date().getFullYear();
    const count = await syncHolidays(year);
    res.json({ message: `${count} feriados sincronizados para ${year}.`, count });
  } catch (error) {
    console.error("Erro ao sincronizar feriados:", error);
    res.status(500).json({ message: "Falha ao buscar feriados na Brasil API.", error: error.message });
  }
});

// ============================================================
// GET /api/admin/overtime/holidays/:year — Lista feriados
// ============================================================
router.get("/holidays/:year", isAuthenticatedAdmin, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    await ensureHolidaysForYear(year);
    const holidays = await Holiday.findAll({
      where: { year },
      order: [["date", "ASC"]],
    });
    res.json(holidays);
  } catch (error) {
    console.error("Erro ao listar feriados:", error);
    res.status(500).json({ message: "Erro interno." });
  }
});

export default router;
