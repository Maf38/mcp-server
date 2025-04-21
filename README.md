# MCP Server (Model Context Protocol)

Serveur de gestion de contexte compatible avec le protocole MCP (Model Context Protocol), utilisant SQLite pour la persistance et SSE (Server-Sent Events) pour les communications en temps réel.

Version actuelle : 2.0.0

## 🚀 Installation

### Docker (Une seule commande)
```bash
docker run -d --name mcp-server --restart unless-stopped -p 3000:3000 -v "$(pwd)/data":/app/data -e NODE_ENV=docker -e PORT=3000 -e DB_PATH=/app/data/context.db -e LOG_LEVEL=info --memory=512m --cpus=1 --health-cmd="wget -qO- http://localhost:3000/health || exit 1" --health-interval=30s --health-timeout=10s --health-retries=3 --health-start-period=10s --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 maf38/mcp-server:2.0.0
```

### Docker Compose (Installation avancée)
```yaml
version: '3'

services:
  mcp-server:
    image: maf38/mcp-server:2.0.0
    container_name: mcp-server
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - /path/to/data:/app/data
    environment:
      NODE_ENV: docker
      PORT: 3000
      DB_PATH: /app/data/context.db
      LOG_LEVEL: info
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
```

⚠️ N'oubliez pas de remplacer `/path/to/data` par le chemin réel où vous voulez stocker la base de données.

### Unraid
1. Allez dans l'Apps
2. Recherchez "MCP Server"
3. Cliquez sur Install

## 🔧 Configuration

### Variables d'environnement

#### Essentielles
- `PORT` : Port d'écoute du serveur (défaut: 3000)
- `DB_PATH` : Chemin de la base de données (défaut: /app/data/context.db)

#### Logging
- `NODE_ENV` : Environnement d'exécution ("docker" pour désactiver les fichiers de logs)
- `LOG_LEVEL` : Niveau de log (error, warn, info, http, debug) (défaut: info)

## 📖 API

### Routes MCP

#### Route SSE (Server-Sent Events)
```http
GET /sse
```
Établit une connexion SSE pour recevoir les mises à jour en temps réel.

#### Message MCP
```http
POST /message
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "context/update",
  "params": {
    "key": "string",
    "value": "string",
    "metadata": {
      "type": "string",
      "timestamp": "string",
      "source": "string"
    }
  }
}
```

### Routes REST

#### Sauvegarder/Mettre à jour un contexte
```http
POST /context
Content-Type: application/json

{
  "key": "string",
  "value": "string",
  "metadata": {
    "type": "string",
    "timestamp": "string",
    "source": "string"
  }
}
```

#### Récupérer un contexte
```http
GET /context/:key
```

#### Opérations par lots (batch)
```http
POST /context/batch
Content-Type: application/json

[
  {
    "key": "string",
    "value": "string",
    "metadata": {
      "type": "string",
      "timestamp": "string",
      "source": "string"
    }
  }
]
```

#### Supprimer un contexte
```http
DELETE /context/:key
```

### Routes système

#### Vérifier l'état du serveur
```http
GET /health
```

#### Obtenir les capacités du serveur
```http
GET /capabilities
```

## 🔍 Logging

### En environnement Docker
- Les logs sont envoyés vers stdout/stderr
- Accessibles via `docker logs mcp-server`
- Niveaux de log configurables via `LOG_LEVEL`

### En environnement standard
- Logs stockés dans le dossier `logs/`
- Rotation quotidienne des fichiers
- Compression automatique des anciens logs
- Conservation pendant 14 jours
- Limite de 20MB par fichier

### Format des logs
```
YYYY-MM-DD HH:mm:ss.SSS [LEVEL] [CONTEXT] Message {Metadata}
```

## 🔒 Persistance des données
Les données sont stockées dans SQLite à l'emplacement spécifié par `DB_PATH`.
Pour Docker et Unraid, montez un volume sur `/app/data`.

## 🛠️ Développement

### Prérequis
- Node.js >= 18
- npm

### Installation
```bash
npm install
npm run build
npm start
```

### Tests
```bash
npm test
```

## 📦 Publication Docker
L'image est disponible sur Docker Hub :
- Version stable (2.0.0) : `maf38/mcp-server:2.0.0`
- Version latest : `maf38/mcp-server:latest`

## 🔄 Intégration avec GitHub Copilot
Ce serveur implémente le protocole MCP (Model Context Protocol) qui permet à GitHub Copilot de maintenir un contexte persistent entre les sessions. Les fonctionnalités incluent :
- Communication bidirectionnelle via SSE
- Format de messages JSON-RPC 2.0
- Persistance SQLite
- Support des métadonnées
- Opérations batch

Pour plus d'informations sur le protocole MCP, consultez la documentation dans le dossier `docs/`.
