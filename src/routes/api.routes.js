import express from "express";
import { Op } from 'sequelize';
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import path from "path";
import ejs from "ejs";

import Comment from "../models/comment.js";
import Ticket from "../models/ticket.js";
import Client from "../models/client.js";
import User from "../models/user.js";
import Project from '../models/project.js';
import TimeLog from '../models/timelog.js';
import MailService from "../services/mail.js";

const router = express.Router();

const isAuthenticatedAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user && req.user.role) {
    return next();
  }
  return res.status(403).json({ message: "Acesso negado." });
};

router.post(
  "/tickets/:ticketId/comments",
  isAuthenticatedAdmin,
  async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { content } = req.body;
      const adminUser = req.user;

      if (!content || content.trim() === "") {
        return res
          .status(400)
          .json({ message: "O comentário não pode estar vazio." });
      }

      const newComment = await Comment.create({
        content,
        ticket_id: ticketId,
        user_id: adminUser.id,
      });

      try {
        const ticket = await Ticket.findByPk(ticketId);
        if (ticket && ticket.clientId) {
          const client = await Client.findByPk(ticket.clientId);
          if (client) {
            const emailHtml = await ejs.renderFile(
              path.join(__dirname, "../views/emails/newCommentByAdmin.ejs"),
              {
                clientName: client.name,
                ticketId: ticket.id,
                ticketTitle: ticket.title,
                adminName: adminUser.name,
                commentContent: newComment.content,
                ticketUrl: `${
                  process.env.BASE_URL || "http://localhost:5000"
                }/portal/tickets/${ticket.id}`,
              }
            );
            await MailService.sendMail(
              client.email,
              `Nova Resposta no seu Chamado ${ticket.title}`,
              emailHtml
            );
          }
        }
      } catch (mailError) {
        console.error(
          "Falha ao enviar email de novo comentário para o cliente:",
          mailError
        );
      }

      return res.status(201).json(newComment);
    } catch (error) {
      console.error("ERRO NA ROTA DA API DE COMENTÁRIOS:", error);
      return res
        .status(500)
        .json({ message: "Ocorreu um erro interno no servidor." });
    }
  }
);

router.post(
  "/tickets/:ticketId/assign",
  isAuthenticatedAdmin,
  async (req, res) => {
    try {
      const { ticketId } = req.params;
      const adminUser = req.user;
      const ticket = await Ticket.findByPk(ticketId);

      if (!ticket) {
        return res.status(404).json({ message: "Chamado não encontrado." });
      }

      await ticket.update({ userId: adminUser.id, status: "pending" });

      try {
        if (ticket.clientId) {
          const client = await Client.findByPk(ticket.clientId);
          if (client) {
            const emailHtml = await ejs.renderFile(
              path.join(__dirname, "../views/emails/ticketAssigned.ejs"),
              {
                clientName: client.name,
                ticketId: ticket.id,
                ticketTitle: ticket.title,
                adminName: adminUser.name,
                ticketUrl: `${
                  process.env.BASE_URL || "http://localhost:5000"
                }/portal/tickets/${ticket.id}`,
              }
            );
            await MailService.sendMail(
              client.email,
              `Seu Chamado ${ticket.title} foi atribuído`,
              emailHtml
            );
          }
        }
      } catch (mailError) {
        console.error(
          "Falha ao enviar email de atribuição de chamado:",
          mailError
        );
      }
      
      return res
        .status(200)
        .json({ message: "Chamado atribuído com sucesso." });
    } catch (error) {
      console.error("ERRO AO ATRIBUIR CHAMADO PELA API:", error);
      return res.status(500).json({ message: "Ocorreu um erro interno." });
    }
  }
);

router.post('/projects/:projectId/reports', isAuthenticatedAdmin, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { reportType, period, startDate, endDate, format } = req.body.data;

    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Projeto não encontrado.' });
    }

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
        case 'custom':
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            break;
        default: // 'current_month'
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
    }
    start.setHours(0, 0, 0, 0);

    let reportResult;
    
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
            order: [['createdAt', 'DESC']]
        });
        reportResult = { tickets: tickets.map(t => t.toJSON()) };
    }

    const responsePayload = {
        ...reportResult,
        project: project.name,
        period: { start: start.toLocaleDateString('pt-BR'), end: end.toLocaleDateString('pt-BR') },
        type: reportType,
    };

    if (format === 'csv') {
        let csv;
        const json2csvParser = new Parser();
        if (reportType === 'hours') {
            const csvData = [{
                "Projeto": responsePayload.project, "Período de Início": responsePayload.period.start,
                "Período de Fim": responsePayload.period.end, "Total de Horas Gastas": responsePayload.totalHours,
            }];
            csv = json2csvParser.parse(csvData);
        }
        if (reportType === 'tickets') {
            const csvData = (responsePayload.tickets || []).map(t => ({
                "ID do Chamado": t.id, "Título": t.title, "Criado Por": t.Client?.name || 'N/D',
                "Status": t.status, "Prioridade": t.priority, "Data de Criação": new Date(t.createdAt).toLocaleDateString('pt-BR'),
            }));
            csv = json2csvParser.parse(csvData);
        }
        res.header('Content-Type', 'text/csv');
        res.attachment(`relatorio_${project.name.toLowerCase().replace(/\s+/g, '_')}.csv`);
        return res.send(csv);
    }

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Relatório');
      const fileName = `relatorio_${project.name.toLowerCase().replace(/\s+/g, '_')}.xlsx`;

      if (reportType === 'hours') {
        worksheet.columns = [
          { header: 'Projeto', key: 'projeto', width: 30 }, { header: 'Período de Início', key: 'inicio', width: 20 },
          { header: 'Período de Fim', key: 'fim', width: 20 }, { header: 'Total de Horas Gastas', key: 'horas', width: 25 },
        ];
        worksheet.addRow({
          projeto: responsePayload.project, inicio: responsePayload.period.start,
          fim: responsePayload.period.end, horas: parseFloat(responsePayload.totalHours),
        });
      }

      if (reportType === 'tickets') {
        worksheet.columns = [
          { header: 'ID do Chamado', key: 'id', width: 15 }, { header: 'Título', key: 'titulo', width: 40 },
          { header: 'Criado Por', key: 'criadoPor', width: 25 }, { header: 'Status', key: 'status', width: 15 },
          { header: 'Prioridade', key: 'prioridade', width: 15 }, { header: 'Data de Criação', key: 'criadoEm', width: 20 },
        ];
        (responsePayload.tickets || []).forEach(t => {
          worksheet.addRow({
            id: t.id, titulo: t.title, criadoPor: t.Client?.name || 'N/D',
            status: t.status, prioridade: t.priority, criadoEm: new Date(t.createdAt).toLocaleDateString('pt-BR'),
          });
        });
      }
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      await workbook.xlsx.write(res);
      return res.end();
    }
    
    return res.json(responsePayload);

  } catch (error) {
    console.error('ERRO AO GERAR RELATÓRIO PELA API:', error);
    return res.status(500).json({ message: 'Ocorreu um erro interno ao gerar o relatório.' });
  }
});

export default router;