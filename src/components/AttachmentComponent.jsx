import React, { useState, useEffect } from 'react';
import { Box, H4, Text, Icon, themeGet } from '@adminjs/design-system';
import styled from 'styled-components';

// --- Styled Components para o nosso componente ---

const AttachmentWrapper = styled(Box)`
  margin-top: 8px;
  margin-bottom: 16px;
`;

const PreviewImage = styled.img`
  max-width: 200px;
  max-height: 150px;
  border-radius: 4px;
  border: 1px solid ${themeGet('colors', 'grey40')};
  object-fit: cover;
  transition: opacity 0.2s ease;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }
`;

const ChipLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid ${themeGet('colors', 'grey40')};
  background-color: ${themeGet('colors', 'grey20')};
  border-radius: 20px;
  text-decoration: none;
  color: ${themeGet('colors', 'grey100')};
  max-width: 350px;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${themeGet('colors', 'primary100')};
    background-color: ${themeGet('colors', 'white')};
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s;

  @keyframes fadeIn {
    from { opacity: 0 }
    to { opacity: 1 }
  }
`;

const ModalContent = styled.img`
  max-width: 90%;
  max-height: 85vh;
  animation: zoomIn 0.3s;

  @keyframes zoomIn {
    from { transform: scale(0.8) }
    to { transform: scale(1) }
  }
`;

const ModalClose = styled.span`
  position: absolute;
  top: 15px;
  right: 35px;
  color: #f1f1f1;
  font-size: 40px;
  font-weight: bold;
  transition: 0.3s;
  cursor: pointer;

  &:hover {
    color: #bbb;
  }
`;

// --- O Componente Principal ---

const AttachmentComponent = (props) => {
  const { record } = props;
  const [isModalOpen, setModalOpen] = useState(false);

  const filename = record.params.filename;
  const fileType = record.params.type;
  const signedUrl = record.params.signedUrl; // URL segura vinda do backend
  const filesize = record.params.size;

  if (!filename) {
    return <Text>-</Text>;
  }

  const isImage = fileType && fileType.startsWith('image/');
  
  const handleImageClick = () => {
    if (isImage) {
      setModalOpen(true);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
  }
  
  // Efeito para fechar o modal com a tecla 'Escape'
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <AttachmentWrapper>
      <H4 style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Anexo</H4>

      {isImage ? (
        <Box>
          <PreviewImage src={signedUrl} alt={filename} onClick={handleImageClick} />
        </Box>
      ) : (
        <ChipLink href={signedUrl} target="_blank">
          <Icon icon="Document" />
          <Box flexGrow={1} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {filename}
          </Box>
          <Icon icon="Download" />
        </ChipLink>
      )}

      {isModalOpen && (
        <ModalOverlay onClick={closeModal}>
          <ModalClose onClick={closeModal}>&times;</ModalClose>
          <ModalContent src={signedUrl} onClick={(e) => e.stopPropagation()} />
        </ModalOverlay>
      )}
    </AttachmentWrapper>
  );
};

export default AttachmentComponent;