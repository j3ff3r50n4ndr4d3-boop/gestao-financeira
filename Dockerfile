# Imagem única para qualquer plataforma que aceite Docker
# (Render, Northflank, Fly.io, Koyeb, Hugging Face Spaces, VPS...)
#
# O Node precisa ser >= 22.5.0 porque o banco usa o módulo nativo node:sqlite.
FROM node:22-alpine

WORKDIR /app

# A aplicação não tem dependências externas: nada para instalar.
# O package.json entra primeiro só para o cache de camadas funcionar.
COPY package.json ./
COPY server ./server
COPY public ./public

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    EFICIENCIA_DB=/app/data/eficiencia.db

# O diretório de dados é criado pela própria aplicação no primeiro boot, e o
# banco vazio é semeado automaticamente (semearSeVazio).
RUN mkdir -p /app/data

EXPOSE 3000

# Sonda de saúde: plataformas gratuitas usam isto para saber se o app subiu.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
