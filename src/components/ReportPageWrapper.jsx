import React from 'react';
import { Box } from '@adminjs/design-system';

const ReportPageWrapper = (props) => {
  const { record } = props;
  
  // A URL da nossa página EJS que criámos no server.js
  const reportUrl = `/admin/projects/${record.params.id}/reports`;

  return (
    <Box variant="grey">
      {/* O iframe ocupa a área de conteúdo e carrega a nossa página */}
      <iframe
        src={reportUrl}
        style={{
          border: 'none',
          width: '100%',
          height: 'calc(100vh - 80px)', // Ajusta a altura para preencher o espaço
        }}
        title={`Relatórios do Projeto ${record.params.id}`}
      />
    </Box>
  );
};

export default ReportPageWrapper;