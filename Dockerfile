# Utiliser une image Node.js officielle comme base
FROM node:18 AS builder

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier les fichiers package.json et package-lock.json
COPY package*.json ./

# Installer toutes les dépendances (y compris devDependencies)
RUN npm install

# Copier les fichiers source
COPY . .

# Compiler TypeScript
RUN npx tsc

# Créer l'image finale
FROM node:18-slim

# Configuration des logs pour Docker
ENV NODE_OPTIONS="--enable-source-maps"
ENV NPM_CONFIG_LOGLEVEL="info"
ENV NODE_ENV="docker"
ENV LOG_LEVEL="info"

WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer uniquement les dépendances de production
RUN npm install --production

# Copier les fichiers compilés et les ressources nécessaires
COPY --from=builder /app/dist ./dist

# Créer un répertoire pour les données SQLite
RUN mkdir -p /app/data

# Exposer le port 3000
EXPOSE 3000

# Démarrer l'application
CMD ["node", "--unhandled-rejections=strict", "dist/index.js"]
