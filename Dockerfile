# Estágio 1: Build - Instalar dependências e construir o projeto
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Estágio 2: Produção - Copiar apenas o necessário para a imagem final
FROM node:18-alpine

WORKDIR /app

# Copia as dependências da imagem de build
COPY --from=build /app/node_modules ./node_modules
# Copia o código já transpilado da imagem de build
COPY --from=build /app/dist ./dist
# Copia as pastas public e views que são necessárias em produção
COPY --from=build /app/public ./public
COPY --from=build /app/src/views ./src/views

EXPOSE 5000

# Comando para iniciar a aplicação
CMD ["node", "dist/server.js"]