// src/components/TicketShow.jsx (VERSÃO FINAL)

import React from 'react';
import { useRecord } from 'adminjs';
import { Box, H2, Label, Text, Badge } from '@adminjs/design-system';
import TicketComments from './TicketComments';

const PropertyInView = ({ label, value }) => (
  <Box mb="lg">
    <Label style={{ textTransform: 'uppercase', fontSize: '12px', color: '#888' }}>{label}</Label>
    <Text fontSize="md">{value || '-'}</Text>
  </Box>
);

const TicketShow = (props) => {
  const { record, resource, loading } = useRecord(props.record, props.resource.id);

  if (loading || !record) {
    return <Box>Carregando...</Box>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb="xl">
        <H2>Chamado #{record.params.id}: {record.params.title}</H2>
        <Badge variant="primary">{record.params.status}</Badge>
      </Box>
      
      <Box>
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

        <Box variant="white" boxShadow="card" p="lg" mt="lg">
          <TicketComments {...props} record={record} resource={resource} />
        </Box>
      </Box>
    </Box>
  );
};

export default TicketShow;