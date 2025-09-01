import React from 'react';

const GoToReportsButton = (props) => {
    const { record } = props;
    // Constrói a URL para a nossa página de relatórios EJS
    const reportUrl = `/admin/projects/${record.params.id}/reports`;

    // Usamos um link <a> HTML simples com estilos para parecer um botão
    return (
        <a href={reportUrl} style={{
            textDecoration: 'none',
            backgroundColor: '#1187BD', // Cor primária do seu tema
            color: 'white',
            padding: '10px 15px',
            borderRadius: '4px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            fontWeight: 'bold',
        }}>
            Ver Relatórios
        </a>
    );
};

export default GoToReportsButton;