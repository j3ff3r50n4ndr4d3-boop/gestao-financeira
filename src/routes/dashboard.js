const express = require('express');
const { getDb } = require('../../database');

const router = express.Router();

// Helper to convert SQL results to objects
function resultToObjects(result) {
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

// Dashboard KPIs
router.get('/kpis', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    // Current month revenue
    const revenueResult = db.exec(`
      SELECT COALESCE(SUM(total_amount), 0) as total 
      FROM sales WHERE user_id = ? AND strftime('%m', sale_date) = ? AND strftime('%Y', sale_date) = ?
    `, [userId, String(currentMonth).padStart(2, '0'), String(currentYear)]);
    const currentRevenue = revenueResult[0]?.values[0]?.[0] || 0;

    // Last month revenue
    const lastRevenueResult = db.exec(`
      SELECT COALESCE(SUM(total_amount), 0) as total 
      FROM sales WHERE user_id = ? AND strftime('%m', sale_date) = ? AND strftime('%Y', sale_date) = ?
    `, [userId, String(lastMonth).padStart(2, '0'), String(lastMonthYear)]);
    const lastRevenue = lastRevenueResult[0]?.values[0]?.[0] || 0;

    // Current month expenses
    const expenseResult = db.exec(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM expenses WHERE user_id = ? AND strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?
    `, [userId, String(currentMonth).padStart(2, '0'), String(currentYear)]);
    const currentExpenses = expenseResult[0]?.values[0]?.[0] || 0;

    // Last month expenses
    const lastExpenseResult = db.exec(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM expenses WHERE user_id = ? AND strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?
    `, [userId, String(lastMonth).padStart(2, '0'), String(lastMonthYear)]);
    const lastExpenses = lastExpenseResult[0]?.values[0]?.[0] || 0;

    // Total revenue (all time)
    const totalRevenueResult = db.exec(`
      SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE user_id = ?
    `, [userId]);
    const totalRevenue = totalRevenueResult[0]?.values[0]?.[0] || 0;

    // Total expenses (all time)
    const totalExpenseResult = db.exec(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ?
    `, [userId]);
    const totalExpenses = totalExpenseResult[0]?.values[0]?.[0] || 0;

    // Total purchases
    const totalPurchasesResult = db.exec(`
      SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE user_id = ?
    `, [userId]);
    const totalPurchases = totalPurchasesResult[0]?.values[0]?.[0] || 0;

    // Accounts receivable
    const receivableResult = db.exec(`
      SELECT COALESCE(SUM(amount), 0) as total FROM accounts_receivable WHERE user_id = ? AND status = 'pending'
    `, [userId]);
    const accountsReceivable = receivableResult[0]?.values[0]?.[0] || 0;

    // Accounts payable
    const payableResult = db.exec(`
      SELECT COALESCE(SUM(amount), 0) as total FROM accounts_payable WHERE user_id = ? AND status = 'pending'
    `, [userId]);
    const accountsPayable = payableResult[0]?.values[0]?.[0] || 0;

    // Total customers
    const customersResult = db.exec(`SELECT COUNT(*) as total FROM customers WHERE user_id = ?`, [userId]);
    const totalCustomers = customersResult[0]?.values[0]?.[0] || 0;

    // Total products
    const productsResult = db.exec(`SELECT COUNT(*) as total FROM products WHERE user_id = ?`, [userId]);
    const totalProducts = productsResult[0]?.values[0]?.[0] || 0;

    // Low stock alert
    const lowStockResult = db.exec(`SELECT COUNT(*) as total FROM products WHERE user_id = ? AND stock_quantity <= min_stock`, [userId]);
    const lowStock = lowStockResult[0]?.values[0]?.[0] || 0;

    // Profit calculation
    const currentProfit = currentRevenue - currentExpenses;
    const profitMargin = currentRevenue > 0 ? ((currentProfit / currentRevenue) * 100).toFixed(1) : 0;
    
    // Revenue growth
    const revenueGrowth = lastRevenue > 0 ? (((currentRevenue - lastRevenue) / lastRevenue) * 100).toFixed(1) : (currentRevenue > 0 ? 100 : 0);
    
    // Expense variation
    const expenseVariation = lastExpenses > 0 ? (((currentExpenses - lastExpenses) / lastExpenses) * 100).toFixed(1) : 0;

    // Cash flow (simplified: revenue - expenses - purchases for current month)
    const purchasesResult = db.exec(`
      SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE user_id = ? AND strftime('%m', purchase_date) = ? AND strftime('%Y', purchase_date) = ?
    `, [userId, String(currentMonth).padStart(2, '0'), String(currentYear)]);
    const currentPurchases = purchasesResult[0]?.values[0]?.[0] || 0;
    const cashFlow = currentRevenue - currentExpenses - currentPurchases;

    // Average ticket
    const salesCountResult = db.exec(`
      SELECT COUNT(*) as total FROM sales WHERE user_id = ? AND strftime('%m', sale_date) = ? AND strftime('%Y', sale_date) = ?
    `, [userId, String(currentMonth).padStart(2, '0'), String(currentYear)]);
    const salesCount = salesCountResult[0]?.values[0]?.[0] || 0;
    const averageTicket = salesCount > 0 ? (currentRevenue / salesCount).toFixed(2) : 0;

    res.json({
      revenue: {
        current: currentRevenue,
        previous: lastRevenue,
        growth: parseFloat(revenueGrowth)
      },
      expenses: {
        current: currentExpenses,
        previous: lastExpenses,
        variation: parseFloat(expenseVariation)
      },
      profit: {
        current: currentProfit,
        margin: parseFloat(profitMargin)
      },
      cashFlow,
      totalRevenue,
      totalExpenses,
      totalPurchases,
      accountsReceivable,
      accountsPayable,
      totalCustomers,
      totalProducts,
      lowStock,
      salesCount,
      averageTicket: parseFloat(averageTicket)
    });
  } catch (error) {
    console.error('Dashboard KPIs error:', error);
    res.status(500).json({ error: 'Erro ao buscar indicadores' });
  }
});

// Monthly revenue chart data
router.get('/chart/revenue', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const year = req.query.year || new Date().getFullYear();
    
    const result = db.exec(`
      SELECT 
        strftime('%m', sale_date) as month,
        SUM(total_amount) as total
      FROM sales 
      WHERE user_id = ? AND strftime('%Y', sale_date) = ?
      GROUP BY strftime('%m', sale_date)
      ORDER BY month
    `, [userId, String(year)]);

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = months.map((name, i) => {
      const monthStr = String(i + 1).padStart(2, '0');
      const found = result[0]?.values.find(r => r[0] === monthStr);
      return { month: name, value: found ? found[1] : 0 };
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

// Monthly expenses chart data
router.get('/chart/expenses', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const year = req.query.year || new Date().getFullYear();
    
    const result = db.exec(`
      SELECT 
        strftime('%m', expense_date) as month,
        SUM(amount) as total
      FROM expenses 
      WHERE user_id = ? AND strftime('%Y', expense_date) = ?
      GROUP BY strftime('%m', expense_date)
      ORDER BY month
    `, [userId, String(year)]);

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = months.map((name, i) => {
      const monthStr = String(i + 1).padStart(2, '0');
      const found = result[0]?.values.find(r => r[0] === monthStr);
      return { month: name, value: found ? found[1] : 0 };
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

// Category breakdown
router.get('/chart/categories', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    
    const result = db.exec(`
      SELECT category, SUM(amount) as total
      FROM expenses
      WHERE user_id = ?
      GROUP BY category
      ORDER BY total DESC
    `, [userId]);

    const data = resultToObjects(result);
    res.json(data.map(d => ({ category: d.category || 'Sem Categoria', total: d.total })));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

// Recent sales
router.get('/recent-sales', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    
    const result = db.exec(`
      SELECT s.*, c.name as customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
      LIMIT 10
    `, [userId]);

    res.json(resultToObjects(result));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar vendas' });
  }
});

// Overdue accounts
router.get('/overdue', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    const receivable = db.exec(`
      SELECT ar.*, c.name as customer_name
      FROM accounts_receivable ar
      LEFT JOIN customers c ON ar.customer_id = c.id
      WHERE ar.user_id = ? AND ar.status = 'pending' AND ar.due_date < ?
      ORDER BY ar.due_date ASC
    `, [userId, today]);

    const payable = db.exec(`
      SELECT ap.*, s.name as supplier_name
      FROM accounts_payable ap
      LEFT JOIN suppliers s ON ap.supplier_id = s.id
      WHERE ap.user_id = ? AND ap.status = 'pending' AND ap.due_date < ?
      ORDER BY ap.due_date ASC
    `, [userId, today]);

    res.json({
      receivable: resultToObjects(receivable),
      payable: resultToObjects(payable)
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar vencimentos' });
  }
});

module.exports = router;
