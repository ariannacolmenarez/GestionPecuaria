# ====================================================================
# Dockerfile Multi-Stage para Despliegue en la Nube (Google Cloud Run / Render / VPS)
# Granja Arianna - Gestión Pecuaria Integral v1.0
# ====================================================================

# Etapa 1: Construcción de la aplicación Web y dependencias
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias del sistema necesarias para compilar módulos nativos
RUN apk add --no-cache python3 make g++

# Copiar descriptores de paquetes
COPY package*.json ./
COPY bun.lock* ./

RUN npm ci

# Copiar el código fuente completo
COPY . .

# Compilar frontend React (genera los assets estáticos)
RUN npm run build

# Etapa 2: Imagen Final Ligera de Producción
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copiar dependencias y artefactos construidos
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/web ./web
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/app/src/main/assets/public ./dist
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json
COPY --from=builder /app/firebase-blueprint.json ./firebase-blueprint.json
COPY --from=builder /app/firestore.rules ./firestore.rules

# Exponer el puerto asignado por la nube
EXPOSE 8080

# Iniciar servidor Node.js/Express
CMD ["npx", "tsx", "web/src/backend/server.ts"]
