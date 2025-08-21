// src/routes/api.routes.js

import express from 'express';
import Comment from '../models/comment.js';
import Ticket from '../models/ticket.js'; // Importação adicionada

const router = express.Router();

const isAuthenticatedAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user && req.user.role) {
    return next();
  }
  return res.status(403).json({ message: 'Acesso negado.' });
};

// Rota para comentários (existente e correta)
router.post('/tickets/:ticketId/comments', isAuthenticatedAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { content } = req.body;
    const adminUserId = req.user.id;

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'O comentário não pode estar vazio.' });
    }

    const newComment = await Comment.create({
      content,
      ticket_id: ticketId,
      user_id: adminUserId,
    });

    return res.status(201).json(newComment);

  } catch (error) {
    console.error('ERRO NA ROTA DA API DE COMENTÁRIOS:', error);
    return res.status(500).json({ message: 'Ocorreu um erro interno no servidor.' });
  }
});

// NOVA ROTA PARA ATRIBUIR CHAMADO
router.post('/tickets/:ticketId/assign', isAuthenticatedAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const adminUserId = req.user.id;

    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Chamado não encontrado.' });
    }

    await ticket.update({ userId: adminUserId, status: 'pending' });

    return res.status(200).json({ message: 'Chamado atribuído com sucesso.' });
  } catch (error) {
    console.error('ERRO AO ATRIBUIR CHAMADO PELA API:', error);
    return res.status(500).json({ message: 'Ocorreu um erro interno.' });
  }
});


export default router;