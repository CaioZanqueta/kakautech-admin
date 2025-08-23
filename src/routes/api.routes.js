import express from "express";
import Comment from "../models/comment.js";
import Ticket from "../models/ticket.js";
import Client from "../models/client.js";
import User from "../models/user.js";
import ejs from "ejs";
import path from "path";
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

      // --- INÍCIO DA NOVA LÓGICA DE EMAIL ---
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
      // --- FIM DA NOVA LÓGICA DE EMAIL ---

      return res
        .status(200)
        .json({ message: "Chamado atribuído com sucesso." });
    } catch (error) {
      console.error("ERRO AO ATRIBUIR CHAMADO PELA API:", error);
      return res.status(500).json({ message: "Ocorreu um erro interno." });
    }
  }
);

export default router;
