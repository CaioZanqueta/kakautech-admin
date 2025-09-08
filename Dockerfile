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

# ===== LINHA DE GARANTIA (CORRIGIDA) =====
# Copia a pasta de componentes originais (necessária para AdminJS.bundle)
COPY --from=build /app/src/components ./src/components

# Copia assets e views
COPY --from=build /app/public ./public
COPY --from=build /app/src/views ./src/views

EXPOSE 5000
CMD ["node", "dist/server.js"]