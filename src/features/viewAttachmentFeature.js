import React from 'react';
import { Record } from 'adminjs';

const ViewAttachment = (props) => {
  const { record } = props;
  const filename = record.get('filename');
  const path = record.get('path');

  if (!path) {
    return <div>Nenhum anexo</div>;
  }

  const downloadUrl = `/admin/api/resource/tickets/record/${record.id()}/download/${path}`;
  const fileType = record.get('type');
  const isImage = fileType && fileType.startsWith('image/');

  return (
    <div>
      {isImage ? (
        <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
          <img src={downloadUrl} alt={filename} style={{ maxWidth: '200px', maxHeight: '200px' }} />
        </a>
      ) : (
        <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
          Ver Anexo: {filename || 'Arquivo'}
        </a>
      )}
    </div>
  );
};

const viewAttachmentFeature = (options = {}) => ({
  components: {
    show: {
      anexo: ViewAttachment, // 'anexo' é o nome da sua propriedade virtual
    },
    list: {
      anexo: ViewAttachment,
    },
  },
});

export default viewAttachmentFeature;