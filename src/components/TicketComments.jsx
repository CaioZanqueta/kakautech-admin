import React, { useState, useEffect } from 'react';
import { ApiClient } from 'adminjs';
import { Box, H3, Text, Button, Loader } from '@adminjs/design-system';
import axios from 'axios';

const commentBoxCss = { border: '1px solid #dee2e6', borderRadius: '8px', padding: '16px', marginBottom: '16px' };
const adminCommentCss = { ...commentBoxCss, backgroundColor: '#f8f9fa' };
const clientCommentCss = { ...commentBoxCss, backgroundColor: '#e7f5ff' };
const textareaStyles = { width: '100%', minHeight: '120px', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px', fontFamily: 'sans-serif', lineHeight: '1.5' };
const errorTextStyles = { color: '#c7254e', backgroundColor: '#f9f2f4', padding: '10px', borderRadius: '4px', marginTop: '10px' };

const TicketComments = (props) => {
  const { record } = props;
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState(null);
  const api = new ApiClient(); 

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await api.resourceAction({
        resourceId: 'comments', actionName: 'list', params: { 'filters.ticket_id': record.id },
      });
      const sortedComments = response.data.records.sort((a, b) => new Date(a.params.createdAt) - new Date(b.params.createdAt));
      setComments(sortedComments);
    } catch (err) {
      console.error("Erro ao buscar comentários:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (record) { fetchComments(); } }, [record.id]);

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (newComment.trim() === '') return;
    
    setError(null);

    try {
      const response = await axios.post(`/api/tickets/${record.id}/comments`, { content: newComment });
      
      if (response.data) {
        setNewComment('');
        fetchComments();
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Ocorreu um erro ao enviar o comentário.';
      setError(message);
    }
  };

  if (loading) { return <Loader />; }

  return (
    <Box>
      <H3>Comentários</H3>
      <Box my="lg">
        {comments.length > 0 ? (
          comments.map(comment => (
            <Box key={comment.id} style={comment.params.user_id ? adminCommentCss : clientCommentCss}>
              <Text fontWeight="bold">
                {/* CÓDIGO MAIS SEGURO AQUI com '?.' */}
                {comment.populated.user_id?.title || comment.populated.client_id?.title || 'Autor Desconhecido'}
                {comment.params.user_id ? ' (Equipe)' : ' (Cliente)'}
              </Text>
              <Text color="grey60" fontSize="sm" mb="md">
                {new Date(comment.params.createdAt).toLocaleString('pt-BR')}
              </Text>
              <Text>{comment.params.content}</Text>
            </Box>
          ))
        ) : (
          <Text>Ainda não há comentários neste chamado.</Text>
        )}
      </Box>

      <Box as="form" onSubmit={handleCommentSubmit}>
        <H3>Adicionar Resposta</H3>
        <textarea
          style={textareaStyles}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escreva seu comentário aqui..."
        />
        {error && <Text style={errorTextStyles}>{error}</Text>}
        <Button type="submit" variant="primary" mt="lg">
          Enviar Comentar
        </Button>
      </Box>
    </Box>
  );
};

export default TicketComments;