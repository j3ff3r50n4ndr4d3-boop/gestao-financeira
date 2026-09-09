# 🚀 Guia de Deploy - ERP Gestão Financeira

## Opções de Deploy Online

### 1. Vercel (Recomendado - Gratuito)

#### Passo a Passo:
1. Acesse [vercel.com](https://vercel.com)
2. Faça login com GitHub
3. Clique em "New Project"
4. Selecione o repositório `gestao-financeira`
5. Configure:
   - **Framework Preset:** Other
   - **Build Command:** `npm install`
   - **Output Directory:** `.`
   - **Install Command:** `npm install`
6. Adicione variável de ambiente:
   - `NODE_ENV`: `production`
7. Clique em "Deploy"

#### Configuração para SQLite:
O Vercel não suporta SQLite em produção. Para usar em produção, migre para PostgreSQL:
- Altere `database.js` para usar `pg` (PostgreSQL)
- Configure DATABASE_URL no Vercel

---

### 2. Railway (Recomendado - Pago/Gratuito)

1. Acesse [railway.app](https://railway.app)
2. Login com GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Selecione `gestao-financeira`
5. Adicione variáveis:
   - `PORT`: `3000`
   - `NODE_ENV`: `production`
6. Deploy automático

**Vantagem:** Suporta SQLite nativamente!

---

### 3. Heroku (Gratuito com limitações)

```bash
# Instalar Heroku CLI
npm install -g heroku

# Login
heroku login

# Criar app
heroku create erp-gestao-financeira

# Adicionar buildpack
heroku buildpacks:set heroku/nodejs

# Deploy
git push heroku main

# Abrir app
heroku open
```

---

### 4. Render (Gratuito)

1. Acesse [render.com](https://render.com)
2. "New Web Service"
3. Conecte o repositório GitHub
4. Configure:
   - **Name:** erp-gestao-financeira
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Deploy

---

### 5. DigitalOcean App Platform (Pago)

1. Acesse [digitalocean.com](https://digitalocean.com)
2. "Apps" → "Create App"
3. Selecione GitHub → `gestao-financeira`
4. Configure:
   - **Resource:** Basic (R$25/mês)
   - **Region:** São Paulo
5. Deploy automático

---

### 6. VPS (Controle Total)

#### Ubuntu 22.04 + PM2:

```bash
# 1. Conectar ao servidor
ssh root@seu-ip

# 2. Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Clonar repositório
cd /var/www
git clone https://github.com/j3ff3r50n4ndr4d3-boop/gestao-financeira.git
cd gestao-financeira

# 4. Instalar dependências
npm install --production

# 5. Instalar PM2
sudo npm install -g pm2

# 6. Iniciar app
pm2 start server.js --name erp
pm2 save
pm2 startup

# 7. Configurar Nginx
sudo apt install nginx
sudo nano /etc/nginx/sites-available/erp

# Configuração Nginx:
server {
    listen 80;
    server_name seu-dominio.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 8. Habilitar SSL (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com
```

---

## 🌐 Deploy com Domínio Próprio

### Opções de Domínio:
- **Registro.br** - R$ 40/ano (.com.br)
- **Namecheap** - R$ 50/ano (.com)
- **GoDaddy** - R$ 60/ano (.com)

### Configuração DNS:
1. Compre o domínio
2. Aponte o DNS para o servidor:
   - **Tipo A** → IP do servidor
   - **TTL** → 3600

---

## 🔒 Configuração de Segurança para Produção

### 1. Variáveis de Ambiente
Crie um arquivo `.env`:
```env
PORT=3000
NODE_ENV=production
JWT_SECRET=sua-chave-secreta-super-segura-aqui
```

### 2. Atualizar server.js para usar .env:
```javascript
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
```

### 3. SSL/HTTPS
- Use Let's Encrypt (gratuito)
- Configure no Nginx ou no serviço de deploy

### 4. Backup Automático
```bash
# Script de backup diário (cron)
0 2 * * * cp /var/www/gestao-financeira/data/erp.db /backups/erp-$(date +\%Y\%m\%d).db
```

---

## 📊 Monitoramento

### UptimeRobot (Gratuito)
1. Acesse [uptimerobot.com](https://uptimerobot.com)
2. Adicione monitor para seu domínio
3. Receba alertas por email

### Logs
```bash
# Ver logs em tempo real
pm2 logs erp

# Rotacionar logs
pm2 install pm2-logrotate
```

---

## 💰 Custos Estimados

| Serviço | Gratuito | Básico | Profissional |
|---------|----------|--------|--------------|
| **Vercel** | ✅ 100GB/mês | - | $20/mês |
| **Railway** | $5/mês grátis | $5-20/mês | $20-50/mês |
| **Render** | ✅ 750h/mês | $7/mês | $25/mês |
| **Heroku** | ✅ 550h/mês | $7/mês | $50/mês |
| **DigitalOcean** | - | $5/mês | $25/mês |
| **VPS próprio** | - | $5-10/mês | $20-50/mês |

### Recomendação para Início:
- **Railway** ou **Render** (fácil, rápido, suporta SQLite)
- Custo: $0-7/mês para começar
- Escala automática quando crescer

---

## 🚀 Deploy Rápido (5 minutos)

### Railway:
1. Acesse [railway.app](https://railway.app)
2. Login com GitHub
3. "New Project" → Deploy do GitHub
4. Selecione o repositório
5. Deploy automático! ✅

**Pronto em 2 minutos!** 🎉

---

## 📞 Suporte

Para dúvidas sobre deploy:
- Railway: [docs.railway.app](https://docs.railway.app)
- Render: [render.com/docs](https://render.com/docs)
- Vercel: [vercel.com/docs](https://vercel.com/docs)

---

## ✅ Checklist Pré-Deploy

- [ ] Testar localmente (`npm start`)
- [ ] Verificar se o banco é criado corretamente
- [ ] Testar login e todas as funcionalidades
- [ ] Configurar variáveis de ambiente
- [ ] Configurar domínio (opcional)
- [ ] Configurar SSL/HTTPS
- [ ] Configurar backup automático
- [ ] Configurar monitoramento de uptime
- [ ] Testar performance com dados reais

---

**Sistema pronto para deploy!** 🚀

O ERP está 100% funcional e pronto para ser publicado online. Escolha a plataforma que melhor se adapta às suas necessidades e siga o guia acima.

