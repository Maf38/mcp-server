# Déploiement en production avec une seule commande

## Commande Docker complète

```bash
docker run -d \
  --name mcp-server \
  --restart unless-stopped \
  -p 3000:3000 \
  -v "$(pwd)/data":/app/data \
  -e NODE_ENV=docker \
  -e PORT=3000 \
  -e DB_PATH=/app/data/context.db \
  -e LOG_LEVEL=info \
  --memory=512m \
  --cpus=1 \
  --health-cmd="wget -qO- http://localhost:3000/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  --health-start-period=10s \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  maf38/mcp-server:2.0.0

# Format une ligne pour copier-coller facile
docker run -d --name mcp-server --restart unless-stopped -p 3000:3000 -v "$(pwd)/data":/app/data -e NODE_ENV=docker -e PORT=3000 -e DB_PATH=/app/data/context.db -e LOG_LEVEL=info --memory=512m --cpus=1 --health-cmd="wget -qO- http://localhost:3000/health || exit 1" --health-interval=30s --health-timeout=10s --health-retries=3 --health-start-period=10s --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 maf38/mcp-server:2.0.0

## Commandes utiles

# Voir les logs
docker logs -f mcp-server

# Mettre à jour vers une nouvelle version
docker pull maf38/mcp-server:2.0.0
docker rm -f mcp-server
# Puis relancer la commande docker run ci-dessus

# Vérifier l'état du conteneur
docker inspect mcp-server
```
