// src/locales/resources.js

const commonProps = {
  status: "Situação",
  createdAt: "Criação",
  updatedAt: "Atualização",
};

export default {
  users: {
    actions: {
      resetPassword: "Redefinir senha",
    },
    properties: {
      id: "ID",
      initials: "Iniciais",
      name: "Nome",
      email: "Email",
      password: "Senha",
      passwordHash: "Senha criptografada",
      role: "Perfil",
      ...commonProps,
    },
  },
  projects: {
    properties: {
      id: "ID",
      name: "Nome",
      description: "Descrição",
      support_hours_limit: "Limite de Horas",
      userId: "Responsável",
      ...commonProps,
    },
  },
  tasks: {
    properties: {
      id: "ID",
      due_date: "Data de entrega",
      effort: "Esforço",
      title: "Título",
      description: "Descrição",
      order: "Prioridade",
      attachment: "Anexo",
      projectId: "Projeto",
      userId: "Responsável",
      ...commonProps,
    },
  },
  clients: {
    properties: {
      id: "ID",
      name: "Nome",
      email: "Email",
      projectId: "Projeto",
      ...commonProps,
    },
  },
  tickets: {
    properties: {
      id: "ID",
      title: "Título",
      description: "Descrição",
      clientId: "Cliente",
      projectId: "Projeto",
      userId: "Responsável",
      attachment: "Anexo",
      priority: "Prioridade",
      ...commonProps,
    },
  },
};