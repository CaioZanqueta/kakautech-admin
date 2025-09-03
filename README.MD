# Task Manager & Portal do Cliente

## 📝 Descrição

Esta é uma aplicação completa para gestão de projetos e tarefas internas, combinada com um portal de suporte ao cliente. A plataforma permite que a equipa interna organize projetos e tarefas, enquanto os clientes podem abrir, acompanhar e interagir com chamados de suporte, tudo num único sistema integrado.

## ✨ Funcionalidades Principais

A plataforma está dividida em duas grandes áreas:

### Painel de Administração (AdminJS)

  - **Gestão Completa:** Interface para criar, ler, atualizar e apagar (CRUD) Projetos, Tarefas, Clientes, Usuários e Chamados.
  - **Dashboard de Gestão:** Painel inicial com gráficos de resumo sobre o estado das tarefas internas e dos chamados de clientes.
  - **Logs de Atividade:** Um histórico detalhado em cada chamado, registando todas as alterações de status e de responsável, para máxima rastreabilidade.
  - **Sistema de Relatórios Avançado:** Uma página dedicada por projeto para gerar relatórios de:
      - **Horas Gastas:** Com filtros por mês, trimestre e ano.
      - **Lista de Chamados:** Filtrados por período.
  - **Exportação de Relatórios:** Capacidade de exportar qualquer relatório para os formatos **CSV**, **Excel (.xlsx)** e **PDF**, com um layout profissional e o logótipo da empresa.

### Portal do Cliente

  - **Autenticação Segura:** Login com Email/Senha e integração com provedores sociais (Google e Microsoft).
  - **Dashboard do Cliente:** Página inicial personalizada com um resumo do estado dos seus chamados e do consumo de horas de suporte.
  - **Sistema de Chamados (Tickets):**
      - Abertura de novos chamados com título, descrição, prioridade e anexos.
      - Acompanhamento do status e do histórico de todos os chamados do seu projeto.
      - Comunicação com a equipa através de um histórico de comentários.
  - **Gestão de Perfil:** Página "Meu Perfil" onde o cliente pode ver os seus dados, alterar a sua senha e fazer o upload de uma foto de perfil.
  - **Controlo de Horas Mensal:** O sistema de horas de suporte contratadas reinicia automaticamente a cada mês, com base no tempo registado em cada sessão de trabalho.

## 🛠️ Tecnologias Utilizadas (Stack)

  - **Backend:** Node.js, Express.js
  - **Base de Dados:** PostgreSQL com Sequelize (ORM)
  - **Painel de Admin:** AdminJS com React
  - **Portal do Cliente:** EJS (Embedded JavaScript templates)
  - **Autenticação:** Passport.js
  - **Upload de Ficheiros:** AWS S3, com `multer` e `multer-s3`
  - **Geração de PDF:** Puppeteer
  - **Geração de Excel/CSV:** `exceljs`, `json2csv`

## 🚀 Requisitos e Instalação

Para configurar e executar este projeto num novo ambiente de desenvolvimento.

#### 1\. Pré-requisitos

  - **Node.js** (versão 18 ou superior)
  - **Yarn** ou **NPM**
  - Um servidor de **PostgreSQL** a correr localmente ou na nuvem

#### 2\. Clonar o Repositório

```bash
git clone <url-do-seu-repositorio>
cd <pasta-do-projeto>
```

#### 3\. Instalar Dependências

```bash
npm install
```

ou

```bash
yarn install
```

#### 4\. Configurar a Base de Dados

  - Crie uma nova base de dados no seu servidor PostgreSQL (ex: `task_manager_db`).
  - Certifique-se de que tem um utilizador e senha com permissões para aceder a esta base de dados.

#### 5\. Configurar as Variáveis de Ambiente

  - Na raiz do projeto, crie um ficheiro chamado `.env`.
  - Copie o conteúdo do modelo abaixo e preencha com as suas próprias credenciais.

#### 6\. Executar as Migrações da Base de Dados

Este comando irá criar todas as tabelas necessárias na sua base de dados.

```bash
npm run db:migrate
```

#### 7\. (Opcional) Popular com Dados Iniciais

Se tiver ficheiros de "seed" para criar dados iniciais (como um utilizador administrador), execute:

```bash
npm run db:seed
```

#### 8\. Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

  - A aplicação estará a correr em `http://localhost:5000` (ou na porta que definir).
  - O AdminJS estará acessível em `http://localhost:5000/admin`.
  - O Portal do Cliente estará em `http://localhost:5000/portal`.

## ⚙️ Variáveis de Ambiente (Modelo para `.env`)

Copie o bloco abaixo para o seu ficheiro `.env` e substitua os valores.

```env
# Base de Dados PostgreSQL
DB_HOST=localhost
DB_USER=postgres
DB_PASS=sua_senha_do_postgres
DB_NAME=task_manager_db

# Segredo para Sessões da Aplicação (use um gerador de strings aleatórias longo)
SECRET=seu_segredo_super_secreto_para_sessoes

# Credenciais AWS S3 para Upload de Ficheiros
AWS_ACCESS_KEY_ID=sua_access_key_id_da_aws
AWS_SECRET_ACCESS_KEY=sua_secret_access_key_da_aws
AWS_REGION=sua_regiao_da_aws (ex: us-east-1)
AWS_BUCKET=nome_do_seu_bucket_s3

# Credenciais para Envio de Email (ex: Mailtrap para desenvolvimento)
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USER=seu_usuario_mailtrap
MAIL_PASS=sua_senha_mailtrap

# Email do Administrador para receber notificações
ADMIN_EMAIL=seu-email-admin@exemplo.com

# Autenticação Social (OAuth 2.0)
GOOGLE_CLIENT_ID=seu_id_de_cliente_google
GOOGLE_CLIENT_SECRET=seu_google_client_secret
MICROSOFT_CLIENT_ID=seu_id_de_cliente_microsoft
MICROSOFT_CLIENT_SECRET=seu_segredo_de_cliente_microsoft

# URL Base da Aplicação (importante para produção)
BASE_URL=http://localhost:5000
```

## 📜 Scripts Disponíveis

  - `npm run dev`: Inicia a aplicação em modo de desenvolvimento com `nodemon`.
  - `npm run build`: Transpila o código da pasta `src` para a pasta `dist` para produção.
  - `npm run start`: Inicia a aplicação em modo de produção a partir da pasta `dist`.
  - `npm run db:migrate`: Aplica todas as migrações pendentes na base de dados.
  - `npm run db:undo`: Reverte a última migração aplicada.
  - `npm run db:seed`: Popula a base de dados com dados iniciais.