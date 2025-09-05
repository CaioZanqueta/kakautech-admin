# Estágio 1: Build - Instalar dependências e construir o projeto
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm cache clean --force
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Estágio 2: Produção - Copiar apenas o necessário para a imagem final
FROM node:18-alpine

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# ===== LINHA DE GARANTIA ADICIONADA =====
# Copia explicitamente a pasta de componentes para garantir que ela exista
COPY --from=build /app/src/components ./src/components
# =========================================

COPY --from=build /app/public ./public
COPY --from=build /app/src/views ./src/views

EXPOSE 5000

CMD ["node", "dist/server.js"]