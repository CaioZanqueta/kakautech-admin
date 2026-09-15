'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('groups', [
      {
        name: 'Cyber Security',
        slug: 'cyber-security',
        description: 'Equipe de segurança cibernética e proteção de dados.',
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Control-M',
        slug: 'control-m',
        description: 'Equipe de orquestração e agendamento de jobs com Control-M.',
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Fábrica de Software',
        slug: 'fabrica-de-software',
        description: 'Equipe de desenvolvimento e entrega de soluções de software.',
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'ITSM',
        slug: 'itsm',
        description: 'Equipe de gestão de serviços de TI e suporte operacional.',
        status: 'active',
        created_at: now,
        updated_at: now,
      },
    ], {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('groups', {
      slug: ['cyber-security', 'control-m', 'fabrica-de-software', 'itsm'],
    }, {});
  },
};
