import express from 'express';
import Comment from '../models/comment.js';

const router = express.Router();

// Middleware para garantir que apenas um admin autenticado pode usar esta rota
const isAuthenticatedAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user && req.user.role) { // Verifica se é um User e não um Client
    return next();
  }
  return res.status(403).json({ message: 'Acesso negado.' });
};

// POST /api/tickets/:ticketId/comments
router.post('/tickets/:ticketId/comments', isAuthenticatedAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { content } = req.body;
    const adminUserId = req.user.id; // passport nos dá o user logado

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
    console.error('ERRO NA ROTA DA API PERSONALIZADA:', error);
    return res.status(500).json({ message: 'Ocorreu um erro interno no servidor.' });
  }
});

export default router;