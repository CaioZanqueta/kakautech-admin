// src/components/AssignToMeButton.jsx (ARQUIVO NOVO)

import React, { useState } from 'react';
import { Button, Icon } from '@adminjs/design-system';
import { useNotice } from 'adminjs';
import axios from 'axios';

const AssignToMeButton = (props) => {
  const { record, resource } = props;
  const [loading, setLoading] = useState(false);
  const addNotice = useNotice();

  const handleClick = async () => {
    setLoading(true);
    try {
      await axios.post(`/api/tickets/${record.id}/assign`);
      
      addNotice({
        message: 'Chamado atribuído com sucesso! A página será atualizada.',
        type: 'success',
      });

      // Força o recarregamento da página após um pequeno delay para a notificação aparecer
      setTimeout(() => {
        window.location.reload();
      }, 800);

    } catch (error) {
      const message = error.response?.data?.message || 'Ocorreu um erro ao atribuir o chamado.';
      addNotice({ message, type: 'error' });
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading} variant="primary">
      <Icon icon="UserPlus" />
      {loading ? 'A Atribuir...' : 'Atribuir a Mim'}
    </Button>
  );
};

export default AssignToMeButton;