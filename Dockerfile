# Estágio 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Estágio 2: Produção
FROM node:22-alpine
WORKDIR /app

# Copia node_modules e dist da build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/.sequelizerc ./.sequelizerc

# Copia os arquivos necessários para as migrações
COPY --from=build /app/src/config ./src/config
COPY --from=build /app/src/database ./src/database
COPY --from=build /app/src/models ./src/models

# Copia assets e views
COPY --from=build /app/public ./public
COPY --from=build /app/src/views ./src/views
COPY --from=build /app/src/components ./src/components

EXPOSE 5000

# Script de inicialização que tenta rodar migrações e sementes antes de iniciar o app
CMD ["sh", "-c", "npx sequelize-cli db:migrate && (npx sequelize-cli db:seed:all || true) && node dist/server.js"]
