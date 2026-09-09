const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase } = require('./database');
const { authenticateToken } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});
app.use('/api/', limiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const customersRoutes = require('./src/routes/customers');
const productsRoutes = require('./src/routes/products');
const salesRoutes = require('./src/routes/sales');
const purchasesRoutes = require('./src/routes/purchases');
const expensesRoutes = require('./src/routes/expenses');
const suppliersRoutes = require('./src/routes/suppliers');
const financialRoutes = require('./src/routes/financial');
const subscriptionsRoutes = require('./src/routes/subscriptions');

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions/plans', subscriptionsRoutes);

// Protected routes
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/customers', authenticateToken, customersRoutes);
app.use('/api/products', authenticateToken, productsRoutes);
app.use('/api/sales', authenticateToken, salesRoutes);
app.use('/api/purchases', authenticateToken, purchasesRoutes);
app.use('/api/expenses', authenticateToken, expensesRoutes);
app.use('/api/suppliers', authenticateToken, suppliersRoutes);
app.use('/api/financial', authenticateToken, financialRoutes);
app.use('/api/subscriptions', authenticateToken, subscriptionsRoutes);

// Serve the SPA for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 ERP Sistema de Gestão Financeira`);
      console.log(`📡 Server running on http://0.0.0.0:${PORT}`);
      console.log(`👤 Admin: admin@erp.com / admin123`);
      console.log(`📊 Dashboard com KPIs financeiros`);
      console.log(`💼 Módulos: Vendas, Compras, Estoque, Financeiro\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
