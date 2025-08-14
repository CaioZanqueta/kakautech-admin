// src/components/TicketShow.jsx (VERSÃO FINAL COM LAYOUT DE COLUNA ÚNICA)

import React from 'react';
import { Box, H2, Label, Text, Badge } from '@adminjs/design-system';
import TicketComments from './TicketComments';

const PropertyInView = ({ label, value }) => (
  <Box mb="lg">
    <Label style={{ textTransform: 'uppercase', fontSize: '12px', color: '#888' }}>{label}</Label>
    <Text fontSize="md">{value || '-'}</Text>
  </Box>
);

const TicketShow = (props) => {
  const { record } = props;

  if (!record) {
    return <Text>Erro: Registro não encontrado.</Text>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb="xl">
        <H2>Chamado #{record.params.id}: {record.params.title}</H2>
        <Badge variant="primary">{record.params.status}</Badge>
      </Box>
      
      {/* Layout de Coluna Única */}
      <Box>
        {/* Card de Detalhes e Descrição */}
        <Box variant="white" boxShadow="card" p="lg">
          <PropertyInView label="Cliente" value={record.populated.clientId?.title} />
          <PropertyInView label="Projeto" value={record.populated.projectId?.title} />
          <PropertyInView label="Responsável" value={record.populated.userId?.title} />
          
          <Box mt="xl">
            <Label style={{ textTransform: 'uppercase', fontSize: '12px', color: '#888' }}>Descrição</Label>
            <Text style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', marginTop: '8px' }}>
              {record.params.description}
            </Text>
          </Box>
        </Box>

        {/* Card de Comentários, agora posicionado abaixo */}
        <Box variant="white" boxShadow="card" p="lg" mt="lg">
          <TicketComments {...props} />
        </Box>
      </Box>
    </Box>
  );
};

export default TicketShow;