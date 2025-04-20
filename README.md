# MCP Server (Model Context Protocol)

Serveur de gestion de contexte basé sur SQLite pour stocker et récupérer des informations contextuelles.

Version actuelle : 1.0.0

## 🚀 Installation

### Docker
Format multi-lignes :
```bash
docker run -d \
  --name mcp-server \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /path/to/data:/app/data \
  -e PORT=3000 \
  -e DB_PATH=/app/data/context.db \
  --memory=512m \
  --memory-swap=1g \
  --cpus=1 \
  maf38/mcp-server:1.0.0
```

Format une ligne (pour MobaXterm) :
```bash
docker run -d --name mcp-server --restart unless-stopped -p 3000:3000 -v /path/to/data:/app/data -e PORT=3000 -e DB_PATH=/app/data/context.db --memory=512m --memory-swap=1g --cpus=1 maf38/mcp-server:1.0.0
```

⚠️ N'oubliez pas de remplacer `/path/to/data` par le chemin réel où vous voulez stocker les données.

### Unraid
1. Allez dans l'Apps
2. Recherchez "MCP Server"
3. Cliquez sur Install

## 🔧 Configuration

Variables d'environnement disponibles :
- `PORT` : Port d'écoute du serveur (défaut: 3000)
- `DB_PATH` : Chemin de la base de données (défaut: /app/data/context.db)

## 📖 API

### Sauvegarder/Mettre à jour un contexte
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

### Récupérer un contexte
```http
GET /context/:key
```

### Opérations par lots (batch)
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

### Supprimer un contexte
```http
DELETE /context/:key
```

### Vérifier l'état du serveur
```http
GET /health
```

### Obtenir les capacités du serveur
```http
GET /capabilities
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
- Version stable (1.0.0) : `maf38/mcp-server:1.0.0`
- Version latest : `maf38/mcp-server:latest`
