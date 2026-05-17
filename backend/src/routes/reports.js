const router = require('express').Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendCustomEmail } = require('../services/email');

router.use(requireAuth);

// GET /api/reports/statement-download — Public/Secure printable statement PDF download
router.get('/statement-download', async (req, res) => {
  try {
    const dateStr = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
    const requesterName = req.user.display_name || 'Administrator';

    // Fetch zero stock items
    const [zeroStock] = await pool.query(`
      SELECT name, 'Kitchen' as module, unit FROM kitchen_items WHERE is_folder = 0 AND quantity = 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Spa', unit FROM spa_items WHERE is_folder = 0 AND quantity = 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Shop', unit FROM shop_items WHERE is_folder = 0 AND quantity = 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Gym', unit FROM gym_inventory WHERE is_folder = 0 AND quantity = 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Supplies', unit FROM supplies_items WHERE is_folder = 0 AND quantity = 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Laundry', unit FROM laundry_items WHERE is_folder = 0 AND quantity = 0 AND is_active = 1
      ORDER BY name
    `);

    // Fetch low stock warnings (quantity < reorder_level AND reorder_level > 0 AND is_active = 1)
    const [lowStock] = await pool.query(`
      SELECT name, 'Kitchen' as module, quantity, unit, reorder_level FROM kitchen_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Spa', quantity, unit, reorder_level FROM spa_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Shop', quantity, unit, reorder_level FROM shop_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Gym', quantity, unit, reorder_level FROM gym_inventory WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Supplies', quantity, unit, reorder_level FROM supplies_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Laundry', quantity, unit, reorder_level FROM laundry_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      ORDER BY name
    `);

    // Fetch pending maintenance sorted by days_open DESC
    const [pendingMaint] = await pool.query(`
      SELECT 'Kitchen' as module, m.description, m.status,
             i.name as item, DATEDIFF(NOW(), m.created_at) as days_open
      FROM kitchen_maintenance m
      JOIN kitchen_items i ON m.item_id = i.id
      WHERE m.status = 'pending'
      UNION ALL
      SELECT 'Spa' as module, m.description, m.status,
             i.name as item, DATEDIFF(NOW(), m.created_at) as days_open
      FROM spa_maintenance m
      JOIN spa_items i ON m.item_id = i.id
      WHERE m.status = 'pending'
      UNION ALL
      SELECT 'Gym' as module, m.description, m.status,
             i.name as item, DATEDIFF(NOW(), m.created_at) as days_open
      FROM gym_maintenance m
      JOIN gym_inventory i ON m.item_id = i.id
      WHERE m.status = 'pending'
      ORDER BY days_open DESC
    `);

    const [needsRes] = await pool.query(`
      SELECT status, COALESCE(urgency, 'Medium') as urgency, COALESCE(item, '') as item, COALESCE(estimated_price, 0) as estimated_price, COALESCE(currency, 'KSH') as currency, created_at
      FROM needs
      WHERE is_active = 1 AND status != 'fulfilled'
      ORDER BY
        CASE COALESCE(urgency, 'Medium') WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
        created_at ASC
    `);

    // Fetch transaction volume count per module this calendar month
    const [movementSummary] = await pool.query(`
      SELECT 'Kitchen' as module, 
        COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawals,
        COALESCE(SUM(CASE WHEN action = 'restock' THEN 1 ELSE 0 END), 0) as restocks
      FROM kitchen_transactions 
      WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      UNION ALL
      SELECT 'Spa', 
        COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawals,
        COALESCE(SUM(CASE WHEN action = 'restock' THEN 1 ELSE 0 END), 0) as restocks
      FROM spa_transactions 
      WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      UNION ALL
      SELECT 'Shop', 
        COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawals,
        COALESCE(SUM(CASE WHEN action = 'restock' THEN 1 ELSE 0 END), 0) as restocks
      FROM shop_transactions 
      WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      UNION ALL
      SELECT 'Gym', 
        COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawals,
        COALESCE(SUM(CASE WHEN action = 'restock' THEN 1 ELSE 0 END), 0) as restocks
      FROM gym_transactions 
      WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      UNION ALL
      SELECT 'Supplies', 
        COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawals,
        COALESCE(SUM(CASE WHEN action = 'restock' THEN 1 ELSE 0 END), 0) as restocks
      FROM supplies_transactions 
      WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      UNION ALL
      SELECT 'Laundry', 
        COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawals,
        COALESCE(SUM(CASE WHEN action = 'restock' THEN 1 ELSE 0 END), 0) as restocks
      FROM laundry_transactions 
      WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
    `);

    const pdfBuffer = await generatePDFReportBuffer(zeroStock, lowStock, pendingMaint, needsRes, movementSummary, dateStr, requesterName);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Swiss_Side_Operations_Statement.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[Statement Download Error]', err);
    res.status(500).json({ error: 'Server error generating operations statement PDF.' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const results = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM kitchen_items WHERE is_active = 1 AND is_folder = 0'),
      pool.query('SELECT COUNT(*) as count FROM spa_items WHERE is_active = 1 AND is_folder = 0'),
      pool.query('SELECT COUNT(*) as count FROM shop_items WHERE is_active = 1 AND is_folder = 0'),
      pool.query('SELECT COUNT(*) as count FROM gym_inventory WHERE is_active = 1 AND is_folder = 0'),
      pool.query('SELECT COUNT(*) as count FROM supplies_items WHERE is_active = 1 AND is_folder = 0'),
      pool.query('SELECT COUNT(*) as count FROM laundry_items WHERE is_active = 1 AND is_folder = 0'),
      pool.query('SELECT COUNT(*) as count FROM accommodation_houses WHERE is_active = 1'),
      pool.query('SELECT COUNT(*) as count FROM needs WHERE status != "fulfilled" AND is_active = 1')
    ]);
    res.json({
      kitchen: results[0][0][0].count,
      spa: results[1][0][0].count,
      shop: results[2][0][0].count,
      gym: results[3][0][0].count,
      supplies: results[4][0][0].count,
      laundry: results[5][0][0].count,
      accommodation: results[6][0][0].count,
      needs: results[7][0][0].count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/analytics — Dynamic operational analytics for dashboard
router.get('/analytics', async (req, res) => {
  try {
    const [kitchenTx, spaTx, shopTx, gymTx, suppliesTx, laundryTx, lowStockCountRes, fulfilledRes, distributionRes] = await Promise.all([
      pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN action = 'withdraw' THEN quantity ELSE 0 END), 0) as withdrawals,
          COALESCE(SUM(CASE WHEN action = 'restock' THEN quantity ELSE 0 END), 0) as restocks,
          COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawal_tx_count
        FROM kitchen_transactions 
        WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      `),
      pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN action = 'withdraw' THEN quantity ELSE 0 END), 0) as withdrawals,
          COALESCE(SUM(CASE WHEN action = 'restock' THEN quantity ELSE 0 END), 0) as restocks,
          COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawal_tx_count
        FROM spa_transactions 
        WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      `),
      pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN action = 'withdraw' THEN quantity ELSE 0 END), 0) as withdrawals,
          COALESCE(SUM(CASE WHEN action = 'restock' THEN quantity ELSE 0 END), 0) as restocks,
          COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawal_tx_count
        FROM shop_transactions 
        WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      `),
      pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN action = 'withdraw' THEN quantity ELSE 0 END), 0) as withdrawals,
          COALESCE(SUM(CASE WHEN action = 'restock' THEN quantity ELSE 0 END), 0) as restocks,
          COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawal_tx_count
        FROM gym_transactions 
        WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      `),
      pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN action = 'withdraw' THEN quantity ELSE 0 END), 0) as withdrawals,
          COALESCE(SUM(CASE WHEN action = 'restock' THEN quantity ELSE 0 END), 0) as restocks,
          COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawal_tx_count
        FROM supplies_transactions 
        WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      `),
      pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN action = 'withdraw' THEN quantity ELSE 0 END), 0) as withdrawals,
          COALESCE(SUM(CASE WHEN action = 'restock' THEN quantity ELSE 0 END), 0) as restocks,
          COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawal_tx_count
        FROM laundry_transactions 
        WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      `),
      pool.query(`
        SELECT COUNT(*) as count FROM (
          SELECT id FROM kitchen_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
          UNION ALL
          SELECT id FROM spa_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
          UNION ALL
          SELECT id FROM shop_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
          UNION ALL
          SELECT id FROM gym_inventory WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
          UNION ALL
          SELECT id FROM supplies_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
          UNION ALL
          SELECT id FROM laundry_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
        ) combined
      `),
      pool.query(`
        SELECT COUNT(*) as count FROM needs 
        WHERE status = 'fulfilled' AND is_active = 1 
          AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())
      `),
      pool.query(`
        SELECT 'Kitchen' as module, COUNT(*) as count FROM kitchen_items WHERE is_active = 1 AND is_folder = 0
        UNION ALL
        SELECT 'Spa', COUNT(*) FROM spa_items WHERE is_active = 1 AND is_folder = 0
        UNION ALL
        SELECT 'Shop', COUNT(*) FROM shop_items WHERE is_active = 1 AND is_folder = 0
        UNION ALL
        SELECT 'Gym', COUNT(*) FROM gym_inventory WHERE is_active = 1 AND is_folder = 0
        UNION ALL
        SELECT 'Supplies', COUNT(*) FROM supplies_items WHERE is_active = 1 AND is_folder = 0
        UNION ALL
        SELECT 'Laundry', COUNT(*) FROM laundry_items WHERE is_active = 1 AND is_folder = 0
      `)
    ]);

    const totalWithdrawalsQty = 
      parseFloat(kitchenTx[0][0].withdrawals || 0) +
      parseFloat(spaTx[0][0].withdrawals || 0) +
      parseFloat(shopTx[0][0].withdrawals || 0) +
      parseFloat(gymTx[0][0].withdrawals || 0) +
      parseFloat(suppliesTx[0][0].withdrawals || 0) +
      parseFloat(laundryTx[0][0].withdrawals || 0);

    const totalRestocksQty = 
      parseFloat(kitchenTx[0][0].restocks || 0) +
      parseFloat(spaTx[0][0].restocks || 0) +
      parseFloat(shopTx[0][0].restocks || 0) +
      parseFloat(gymTx[0][0].restocks || 0) +
      parseFloat(suppliesTx[0][0].restocks || 0) +
      parseFloat(laundryTx[0][0].restocks || 0);

    const totalMovements = totalWithdrawalsQty + totalRestocksQty;
    const movementRate = totalMovements === 0 ? 0 : Math.round((totalWithdrawalsQty / totalMovements) * 100 * 10) / 10;

    const stockTurnover = 
      parseInt(kitchenTx[0][0].withdrawal_tx_count || 0) +
      parseInt(spaTx[0][0].withdrawal_tx_count || 0) +
      parseInt(shopTx[0][0].withdrawal_tx_count || 0) +
      parseInt(gymTx[0][0].withdrawal_tx_count || 0) +
      parseInt(suppliesTx[0][0].withdrawal_tx_count || 0) +
      parseInt(laundryTx[0][0].withdrawal_tx_count || 0);

    const itemsBelowThreshold = parseInt(lowStockCountRes[0][0].count || 0);
    const fulfilledRequests = parseInt(fulfilledRes[0][0].count || 0);

    const moduleDistribution = distributionRes[0].map(row => ({
      module: row.module,
      count: parseInt(row.count || 0)
    }));

    res.json({
      stockTurnover,
      itemsBelowThreshold,
      fulfilledRequests,
      movementRate,
      moduleDistribution
    });
  } catch (err) {
    console.error('[Get Analytics Error]', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/movements — Ledger of movements across all or selected modules
router.get('/movements', async (req, res) => {
  const { from, to, module } = req.query;

  if (!from || !to || isNaN(Date.parse(from)) || isNaN(Date.parse(to))) {
    return res.status(400).json({ error: 'Valid "from" and "to" dates are required.' });
  }

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, parseInt(req.query.limit) || 100);
  const offset = (page - 1) * limit;

  const moduleMap = {
    kitchen: {
      moduleName: 'Kitchen',
      query: `SELECT 'Kitchen' as module, i.name as item_name, t.action, t.quantity, t.transaction_date, u.display_name as action_by
              FROM kitchen_transactions t JOIN kitchen_items i ON t.item_id = i.id LEFT JOIN users u ON t.action_by = u.id
              WHERE t.transaction_date BETWEEN ? AND ?`
    },
    spa: {
      moduleName: 'Spa',
      query: `SELECT 'Spa' as module, i.name as item_name, t.action, t.quantity, t.transaction_date, u.display_name as action_by
              FROM spa_transactions t JOIN spa_items i ON t.item_id = i.id LEFT JOIN users u ON t.action_by = u.id
              WHERE t.transaction_date BETWEEN ? AND ?`
    },
    shop: {
      moduleName: 'Shop',
      query: `SELECT 'Shop' as module, i.name as item_name, t.action, t.quantity, t.transaction_date, u.display_name as action_by
              FROM shop_transactions t JOIN shop_items i ON t.item_id = i.id LEFT JOIN users u ON t.action_by = u.id
              WHERE t.transaction_date BETWEEN ? AND ?`
    },
    gym: {
      moduleName: 'Gym',
      query: `SELECT 'Gym' as module, i.name as item_name, t.action, t.quantity, t.transaction_date, u.display_name as action_by
              FROM gym_transactions t JOIN gym_inventory i ON t.item_id = i.id LEFT JOIN users u ON t.action_by = u.id
              WHERE t.transaction_date BETWEEN ? AND ?`
    },
    supplies: {
      moduleName: 'Supplies',
      query: `SELECT 'Supplies' as module, i.name as item_name, t.action, t.quantity, t.transaction_date, u.display_name as action_by
              FROM supplies_transactions t JOIN supplies_items i ON t.item_id = i.id LEFT JOIN users u ON t.action_by = u.id
              WHERE t.transaction_date BETWEEN ? AND ?`
    },
    laundry: {
      moduleName: 'Laundry',
      query: `SELECT 'Laundry' as module, i.name as item_name, t.action, t.quantity, t.transaction_date, u.display_name as action_by
              FROM laundry_transactions t JOIN laundry_items i ON t.item_id = i.id LEFT JOIN users u ON t.action_by = u.id
              WHERE t.transaction_date BETWEEN ? AND ?`
    }
  };

  let activeKeys = Object.keys(moduleMap);
  if (module) {
    const normModule = module.trim().toLowerCase();
    if (!moduleMap[normModule]) {
      return res.status(400).json({ error: 'Invalid module. Must be one of: Kitchen, Spa, Shop, Gym, Supplies, Laundry' });
    }
    activeKeys = [normModule];
  }

  try {
    const unionSql = activeKeys.map(k => moduleMap[k].query).join('\nUNION ALL\n');
    const fullSql = `${unionSql}\nORDER BY transaction_date DESC LIMIT ? OFFSET ?`;
    
    const params = [];
    activeKeys.forEach(() => {
      params.push(from, to);
    });
    params.push(limit, offset);

    const [movements] = await pool.query(fullSql, params);
    res.json(movements);
  } catch (err) {
    console.error('[Get Movements Error]', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/low-stock', async (req, res) => {
  try {
    const [lowStock] = await pool.query(`
      SELECT name, 'Kitchen' as module, quantity, unit, reorder_level FROM kitchen_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Spa', quantity, unit, reorder_level FROM spa_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Shop', quantity, unit, reorder_level FROM shop_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Gym', quantity, unit, reorder_level FROM gym_inventory WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Supplies', quantity, unit, reorder_level FROM supplies_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Laundry', quantity, unit, reorder_level FROM laundry_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      ORDER BY module, name
    `);
    res.json(lowStock);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/maintenance', async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = from && to && !isNaN(Date.parse(from)) && !isNaN(Date.parse(to));

  try {
    const kitQuery = dateFilter
      ? `SELECT m.*, i.name as item_name, 'Kitchen' as module, u.display_name as logged_by_name
         FROM kitchen_maintenance m
         JOIN kitchen_items i ON m.item_id = i.id
         LEFT JOIN users u ON m.logged_by = u.id
         WHERE m.created_at BETWEEN ? AND ?
         ORDER BY m.status ASC, m.created_at DESC`
      : `SELECT m.*, i.name as item_name, 'Kitchen' as module, u.display_name as logged_by_name
         FROM kitchen_maintenance m
         JOIN kitchen_items i ON m.item_id = i.id
         LEFT JOIN users u ON m.logged_by = u.id
         ORDER BY m.status ASC, m.created_at DESC`;

    const spaQuery = dateFilter
      ? `SELECT m.*, i.name as item_name, 'Spa' as module, u.display_name as logged_by_name
         FROM spa_maintenance m
         JOIN spa_items i ON m.item_id = i.id
         LEFT JOIN users u ON m.logged_by = u.id
         WHERE m.created_at BETWEEN ? AND ?
         ORDER BY m.status ASC, m.created_at DESC`
      : `SELECT m.*, i.name as item_name, 'Spa' as module, u.display_name as logged_by_name
         FROM spa_maintenance m
         JOIN spa_items i ON m.item_id = i.id
         LEFT JOIN users u ON m.logged_by = u.id
         ORDER BY m.status ASC, m.created_at DESC`;

    const gymQuery = dateFilter
      ? `SELECT m.*, i.name as item_name, 'Gym' as module, u.display_name as logged_by_name
         FROM gym_maintenance m
         JOIN gym_inventory i ON m.item_id = i.id
         LEFT JOIN users u ON m.logged_by = u.id
         WHERE m.created_at BETWEEN ? AND ?
         ORDER BY m.status ASC, m.created_at DESC`
      : `SELECT m.*, i.name as item_name, 'Gym' as module, u.display_name as logged_by_name
         FROM gym_maintenance m
         JOIN gym_inventory i ON m.item_id = i.id
         LEFT JOIN users u ON m.logged_by = u.id
         ORDER BY m.status ASC, m.created_at DESC`;

    const params = dateFilter ? [from, to] : [];

    const [[kit], [spa], [gym]] = await Promise.all([
      pool.query(kitQuery, params),
      pool.query(spaQuery, params),
      pool.query(gymQuery, params)
    ]);

    const all = [...kit, ...spa, ...gym].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(all);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

const PDFDocument = require('pdfkit');
const { sendDetailedReportWithAttachment } = require('../services/email');

// Helper to generate a clean, emoji-free professional PDF report statement with custom cover page and digital layout
function generatePDFReportBuffer(zeroStock, lowStock, pendingMaint, needsRes, movementSummary, dateStr, requesterName) {
  const cleanText = (str) => String(str || '').replace(/[^\x00-\x7F]/g, "").trim();
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      // Brand Color Palette (Iten Terracotta & Sleek Charcoal)
      const primaryColor = '#A0604E'; // Iten Terracotta
      const charcoal = '#1A1A1A';
      const gray = '#6B7280';
      const borderGray = '#E5E7EB';
      const lightGray = '#F9FAFB';

      // ==========================================
      // COVER PAGE (PAGE 1)
      // ==========================================
      // Large dark banner block that covers almost the full height
      doc.rect(40, 40, 515, 740).fill(charcoal);

      // Top decorative border line in Terracotta
      doc.rect(40, 40, 515, 12).fill(primaryColor);

      // Big Stylized Title
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(38).text(cleanText('SWISS SIDE'), 75, 180, { characterSpacing: 2 });
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(24).text(cleanText('TRAINING CAMP'), 75, 230, { characterSpacing: 1 });

      // Thin terracotta horizontal accent line
      doc.moveTo(75, 275).lineTo(350, 275).strokeColor(primaryColor).lineWidth(3).stroke();

      // Subtitle
      doc.fillColor('#E5E7EB').font('Helvetica').fontSize(14).text(cleanText('INTERNAL OPERATIONS & INVENTORY STATEMENT'), 75, 295, { width: 400, lineGap: 6 });

      // Bottom Metadata Card
      doc.rect(75, 540, 445, 130).fill('#262626');
      doc.strokeColor(primaryColor).lineWidth(1.5).rect(75, 540, 445, 130).stroke();

      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text(cleanText('DOCUMENT CONTROLS & AUDIT METRICS'), 95, 558, { characterSpacing: 0.5 });
      
      doc.fillColor('#9CA3AF').font('Helvetica').fontSize(9)
         .text(cleanText('GENERATED DATE:'), 95, 582)
         .text(cleanText('ISSUED BY:'), 95, 598)
         .text(cleanText('SECURITY PROFILE:'), 95, 614)
         .text(cleanText('SYSTEM CORE:'), 95, 630);

      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
         .text(cleanText(dateStr), 225, 582)
         .text(cleanText(requesterName.toUpperCase()), 225, 598)
         .text(cleanText('RESTRICTED / INTERNAL MANAGEMENT'), 225, 614)
         .text(cleanText('SWISS SIDE WEB OPERATIONS (ACTIVE)'), 225, 630);

      // Footer brand notice
      doc.fillColor('#6B7280').font('Helvetica').fontSize(8).text(cleanText('(c) SWISS SIDE TRAINING CAMP - ITEN - KENYA - SECURE OPERATIONS CONTEXT'), 75, 715);

      // Add a page break to start actual report tables
      doc.addPage();

      // ==========================================
      // REPORT CONTENT PAGES (PAGE 2+)
      // ==========================================
      let y = 60;

      // Header decoration banner for standard pages
      doc.rect(40, 40, 515, 6).fill(primaryColor);
      
      doc.fillColor(charcoal).font('Helvetica-Bold').fontSize(14).text(cleanText('SWISS SIDE TRAINING CAMP'), 40, 55);
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text(cleanText('INTERNAL OPERATIONS & INVENTORY STATEMENT'), 40, 72);
      
      doc.fillColor(gray).font('Helvetica').fontSize(8)
         .text(cleanText(`Report Date: ${dateStr}`), 400, 55, { align: 'right', width: 155 })
         .text(cleanText('Page: 2'), 400, 68, { align: 'right', width: 155 });

      doc.moveTo(40, 88).lineTo(555, 88).strokeColor(borderGray).lineWidth(1).stroke();

      y = 110;

      // Helper function to manage page breaks and keep headers active
      function checkPageBreak(neededHeight) {
        if (y + neededHeight > 780) {
          doc.addPage();
          doc.rect(40, 40, 515, 4).fill(primaryColor);
          doc.fillColor(gray).font('Helvetica').fontSize(8).text(cleanText('Swiss Side Training Camp - Operations Audit Report'), 40, 50);
          doc.moveTo(40, 65).lineTo(555, 65).strokeColor(borderGray).lineWidth(0.5).stroke();
          y = 85;
        }
      }

      // Premium Table styling helper methods with screen-friendly sizes (22px row height)
      function drawTableHeader(yPos, columns) {
        doc.rect(40, yPos, 515, 22).fill(lightGray);
        doc.strokeColor(borderGray).lineWidth(0.5).rect(40, yPos, 515, 22).stroke();
        doc.fillColor(charcoal).font('Helvetica-Bold').fontSize(8.5);
        columns.forEach(col => {
          doc.text(cleanText(col.title.toUpperCase()), col.x, yPos + 7, { width: col.w, align: col.align || 'left' });
        });
      }

      // Draw table row with premium look, bold critical styling, and ample spacing
      function drawTableRow(yPos, columns, rowData, isCritical = false) {
        if (isCritical) {
          doc.rect(40, yPos, 515, 22).fill('#FDF2F2');
        }
        doc.strokeColor(borderGray).lineWidth(0.5).moveTo(40, yPos + 22).lineTo(555, yPos + 22).stroke();
        doc.fillColor(isCritical ? '#9B1C1C' : charcoal).font(isCritical ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
        columns.forEach(col => {
          const val = rowData[col.key] !== undefined ? String(rowData[col.key]) : '';
          doc.text(cleanText(val), col.x, yPos + 7, { width: col.w, align: col.align || 'left' });
        });
      }

      // SECTION 1: CRITICAL ZERO STOCK
      checkPageBreak(70);
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text(cleanText('1. CRITICAL ALERTS (ZERO STOCK ITEMS)'), 40, y);
      y += 20;

      if (zeroStock.length === 0) {
        doc.fillColor('#15803D').font('Helvetica-Bold').fontSize(9).text(cleanText('All systems healthy. No inventory items are currently at zero stock.'), 40, y);
        y += 25;
      } else {
        const cols = [
          { title: 'Item Description', key: 'name', x: 45, w: 250 },
          { title: 'Department Module', key: 'module', x: 300, w: 120 },
          { title: 'Stock Level', key: 'stockStr', x: 430, w: 120, align: 'right' }
        ];
        drawTableHeader(y, cols);
        y += 22;

        zeroStock.forEach(item => {
          checkPageBreak(30);
          const rowData = {
            name: (item.name || '').toUpperCase(),
            module: `${(item.module || '').toUpperCase()} DEPT`,
            stockStr: `0 ${item.unit || 'pcs'}`
          };
          drawTableRow(y, cols, rowData, true);
          y += 22;
        });
        y += 12;
      }

      // SECTION 2: LOW STOCK WARNINGS
      checkPageBreak(70);
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text(cleanText('2. LOW STOCK WARNINGS'), 40, y);
      y += 20;

      if (lowStock.length === 0) {
        doc.fillColor('#15803D').font('Helvetica-Bold').fontSize(9).text(cleanText('All stock levels are currently above reorder thresholds.'), 40, y);
        y += 25;
      } else {
        const cols = [
          { title: 'Item Description', key: 'name', x: 45, w: 220 },
          { title: 'Department', key: 'module', x: 270, w: 100 },
          { title: 'Current Stock', key: 'qtyStr', x: 380, w: 85, align: 'right' },
          { title: 'Reorder Level', key: 'reorderStr', x: 470, w: 80, align: 'right' }
        ];
        drawTableHeader(y, cols);
        y += 22;

        lowStock.forEach(item => {
          checkPageBreak(30);
          const rowData = {
            name: (item.name || '').toUpperCase(),
            module: `${(item.module || '').toUpperCase()} DEPT`,
            qtyStr: `${item.quantity} ${item.unit || 'pcs'}`,
            reorderStr: `${item.reorder_level} ${item.unit || 'pcs'}`
          };
          const isCriticalRow = item.quantity <= (item.reorder_level * 0.5);
          drawTableRow(y, cols, rowData, isCriticalRow);
          y += 22;
        });
        y += 12;
      }

      // SECTION 3: PENDING MAINTENANCE
      checkPageBreak(70);
      doc.fillColor(charcoal).font('Helvetica-Bold').fontSize(11).text(cleanText('3. PENDING EQUIPMENT MAINTENANCE LOG'), 40, y);
      y += 20;

      if (pendingMaint.length === 0) {
        doc.fillColor(gray).font('Helvetica').fontSize(9).text(cleanText('No pending maintenance tickets in the active queue.'), 40, y);
        y += 25;
      } else {
        const cols = [
          { title: 'Equipment / Item', key: 'item', x: 45, w: 140 },
          { title: 'Department', key: 'module', x: 190, w: 80 },
          { title: 'Issue Description', key: 'description', x: 280, w: 200 },
          { title: 'Days Open', key: 'daysStr', x: 490, w: 60, align: 'right' }
        ];
        drawTableHeader(y, cols);
        y += 22;

        pendingMaint.forEach(item => {
          checkPageBreak(30);
          const rowData = {
            item: (item.item || '').toUpperCase(),
            module: `${(item.module || '').toUpperCase()} DEPT`,
            description: item.description || '',
            daysStr: `${item.days_open || 0} day(s)`
          };
          drawTableRow(y, cols, rowData, (item.days_open || 0) >= 7);
          y += 22;
        });
        y += 12;
      }

      // SECTION 4: CAPITAL REQUISITIONS LIST
      checkPageBreak(70);
      doc.fillColor(charcoal).font('Helvetica-Bold').fontSize(11).text(cleanText('4. REQUISITIONS STATUS OVERVIEW'), 40, y);
      y += 20;

      const pendingCount = needsRes.filter(n => (n.status || '').toLowerCase() === 'pending').length;
      const approvedCount = needsRes.filter(n => (n.status || '').toLowerCase() === 'approved').length;
      const orderedCount = needsRes.filter(n => (n.status || '').toLowerCase() === 'ordered').length;
      const highUrgencyNeeds = needsRes.filter(n => (n.urgency || '').toLowerCase() === 'high' || (n.urgency || '').toLowerCase() === 'critical');

      doc.fillColor(charcoal).font('Helvetica').fontSize(9)
         .text(cleanText(`Active Requisition Summary: ${pendingCount} Pending | ${approvedCount} Approved | ${orderedCount} Ordered`), 40, y);
      y += 18;

      if (highUrgencyNeeds.length === 0) {
        doc.fillColor(gray).font('Helvetica').fontSize(9).text(cleanText('No critical or high urgency requisitions currently open.'), 40, y);
        y += 25;
      } else {
        const cols = [
          { title: 'Requested Item Description', key: 'item', x: 45, w: 250 },
          { title: 'Status', key: 'status', x: 300, w: 120 },
          { title: 'Estimated Cost', key: 'costStr', x: 430, w: 120, align: 'right' }
        ];
        drawTableHeader(y, cols);
        y += 22;

        highUrgencyNeeds.forEach(item => {
          checkPageBreak(30);
          const rowData = {
            item: (item.item || '').toUpperCase(),
            status: (item.status || '').toUpperCase(),
            costStr: `${item.currency || 'KSH'} ${parseFloat(item.estimated_price || 0).toLocaleString()}`
          };
          drawTableRow(y, cols, rowData);
          y += 22;
        });
        y += 12;
      }

      // SECTION 5: TRANSACTION VOLUMES
      checkPageBreak(90);
      doc.fillColor(charcoal).font('Helvetica-Bold').fontSize(11).text(cleanText("5. THIS CALENDAR MONTH'S TRANSACTION VOLUMES"), 40, y);
      y += 20;

      let totalWithdrawalsCount = 0;
      let totalRestocksCount = 0;
      movementSummary.forEach(row => {
        totalWithdrawalsCount += parseInt(row.withdrawals || 0);
        totalRestocksCount += parseInt(row.restocks || 0);
      });

      const cols = [
        { title: 'Department Module', key: 'module', x: 45, w: 250 },
        { title: 'Withdrawal Transactions', key: 'withdrawalsStr', x: 300, w: 120, align: 'right' },
        { title: 'Restock Transactions', key: 'restocksStr', x: 430, w: 120, align: 'right' }
      ];
      drawTableHeader(y, cols);
      y += 22;

      movementSummary.forEach(row => {
        checkPageBreak(30);
        const rowData = {
          module: `${(row.module || '').toUpperCase()} INVENTORY`,
          withdrawalsStr: `${row.withdrawals || 0} txn(s)`,
          restocksStr: `${row.restocks || 0} txn(s)`
        };
        drawTableRow(y, cols, rowData);
        y += 22;
      });

      // Total summarizing row
      checkPageBreak(30);
      doc.rect(40, y, 515, 22).fill('#F5F5F5');
      doc.strokeColor(borderGray).lineWidth(0.5).rect(40, y, 515, 22).stroke();
      doc.fillColor(charcoal).font('Helvetica-Bold').fontSize(8.5);
      doc.text(cleanText('TOTAL DEPT TRANSACTIONS'), 45, y + 7);
      doc.text(cleanText(`${totalWithdrawalsCount} withdrawals`), 300, y + 7, { width: 120, align: 'right' });
      doc.text(cleanText(`${totalRestocksCount} restocks`), 430, y + 7, { width: 120, align: 'right' });
      
      doc.end();
    } catch (docErr) {
      reject(docErr);
    }
  });
}

// POST /api/reports/email — Compile and email HTML summary report OR detailed PDF attachment
router.post('/email', async (req, res) => {
  const { email, format } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const isDetailed = format === 'detailed';

  try {
    // SECTION 1: HEADER & USER PROFILE FETCH
    const dateStr = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
    const requesterName = req.user.display_name || 'Administrator';

    // Fetch zero stock items
    const [zeroStock] = await pool.query(`
      SELECT name, 'Kitchen' as module, unit FROM kitchen_items WHERE is_folder = 0 AND quantity = 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Spa', unit FROM spa_items WHERE is_folder = 0 AND quantity = 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Shop', unit FROM shop_items WHERE is_folder = 0 AND quantity = 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Gym', unit FROM gym_inventory WHERE is_folder = 0 AND quantity = 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Supplies', unit FROM supplies_items WHERE is_folder = 0 AND quantity = 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Laundry', unit FROM laundry_items WHERE is_folder = 0 AND quantity = 0 AND is_active = 1
      ORDER BY name
    `);

    // Fetch low stock warnings (quantity < reorder_level AND reorder_level > 0 AND is_active = 1)
    const [lowStock] = await pool.query(`
      SELECT name, 'Kitchen' as module, quantity, unit, reorder_level FROM kitchen_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Spa', quantity, unit, reorder_level FROM spa_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Shop', quantity, unit, reorder_level FROM shop_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Gym', quantity, unit, reorder_level FROM gym_inventory WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Supplies', quantity, unit, reorder_level FROM supplies_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      UNION ALL
      SELECT name, 'Laundry', quantity, unit, reorder_level FROM laundry_items WHERE is_folder = 0 AND quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      ORDER BY name
    `);

    // Fetch pending maintenance sorted by days_open DESC (TASK 2 Swaps m.issue -> m.description and DATEDIFF)
    const [pendingMaint] = await pool.query(`
      SELECT 'Kitchen' as module, m.description, m.status,
             i.name as item, DATEDIFF(NOW(), m.created_at) as days_open
      FROM kitchen_maintenance m
      JOIN kitchen_items i ON m.item_id = i.id
      WHERE m.status = 'pending'
      UNION ALL
      SELECT 'Spa' as module, m.description, m.status,
             i.name as item, DATEDIFF(NOW(), m.created_at) as days_open
      FROM spa_maintenance m
      JOIN spa_items i ON m.item_id = i.id
      WHERE m.status = 'pending'
      UNION ALL
      SELECT 'Gym' as module, m.description, m.status,
             i.name as item, DATEDIFF(NOW(), m.created_at) as days_open
      FROM gym_maintenance m
      JOIN gym_inventory i ON m.item_id = i.id
      WHERE m.status = 'pending'
      ORDER BY days_open DESC
    `);

    const [needsRes] = await pool.query(`
      SELECT status, COALESCE(urgency, 'Medium') as urgency, COALESCE(item, '') as item, COALESCE(estimated_price, 0) as estimated_price, COALESCE(currency, 'KSH') as currency, created_at
      FROM needs
      WHERE is_active = 1 AND status != 'fulfilled'
      ORDER BY
        CASE COALESCE(urgency, 'Medium') WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
        created_at ASC
    `);

    const pendingCount = needsRes.filter(n => (n.status || '').toLowerCase() === 'pending').length;
    const approvedCount = needsRes.filter(n => (n.status || '').toLowerCase() === 'approved').length;
    const orderedCount = needsRes.filter(n => (n.status || '').toLowerCase() === 'ordered').length;
    const highUrgencyNeeds = needsRes.filter(n => (n.urgency || '').toLowerCase() === 'high' || (n.urgency || '').toLowerCase() === 'critical');

    // Fetch transaction volume count per module this calendar month
    const [movementSummary] = await pool.query(`
      SELECT 'Kitchen' as module, 
        COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawals,
        COALESCE(SUM(CASE WHEN action = 'restock' THEN 1 ELSE 0 END), 0) as restocks
      FROM kitchen_transactions 
      WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      UNION ALL
      SELECT 'Spa', 
        COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawals,
        COALESCE(SUM(CASE WHEN action = 'restock' THEN 1 ELSE 0 END), 0) as restocks
      FROM spa_transactions 
      WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      UNION ALL
      SELECT 'Shop', 
        COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawals,
        COALESCE(SUM(CASE WHEN action = 'restock' THEN 1 ELSE 0 END), 0) as restocks
      FROM shop_transactions 
      WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      UNION ALL
      SELECT 'Gym', 
        COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawals,
        COALESCE(SUM(CASE WHEN action = 'restock' THEN 1 ELSE 0 END), 0) as restocks
      FROM gym_transactions 
      WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      UNION ALL
      SELECT 'Supplies', 
        COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawals,
        COALESCE(SUM(CASE WHEN action = 'restock' THEN 1 ELSE 0 END), 0) as restocks
      FROM supplies_transactions 
      WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
      UNION ALL
      SELECT 'Laundry', 
        COALESCE(SUM(CASE WHEN action = 'withdraw' THEN 1 ELSE 0 END), 0) as withdrawals,
        COALESCE(SUM(CASE WHEN action = 'restock' THEN 1 ELSE 0 END), 0) as restocks
      FROM laundry_transactions 
      WHERE MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())
    `);

    let totalWithdrawalsCount = 0;
    let totalRestocksCount = 0;
    movementSummary.forEach(row => {
      totalWithdrawalsCount += parseInt(row.withdrawals || 0);
      totalRestocksCount += parseInt(row.restocks || 0);
    });

    const subject = `Swiss Side Inventory Report — ${dateStr} — Requested by ${requesterName}`;

    if (isDetailed) {
      // 1. GENERATE DETAILED PDF ATTACHMENT
      const pdfBuffer = await generatePDFReportBuffer(zeroStock, lowStock, pendingMaint, needsRes, movementSummary, dateStr, requesterName);

      // 2. CONSTRUCT GORGEOUS HTML EMAIL NOTIFYING OF ATTACHMENT (Strictly Emoji-Free!)
      const detailedEmailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Swiss Side Operational Statement</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f4f1ee;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ee;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e0dbd6;box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                  
                  <!-- HEADER -->
                  <tr>
                    <td align="center" style="background-color:#1a1a1a;padding:40px;">
                      <img src="https://swiss-side.store/logo.png" alt="Swiss Side Logo" width="80" style="display:block;margin-bottom:20px;border-radius:4px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <div style="width:8px;height:8px;background-color:#A0604E;border-radius:50%;display:inline-block;margin-right:10px;vertical-align:middle;"></div>
                            <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;vertical-align:middle;">Swiss Side</span>
                            <span style="color:#666;font-size:13px;font-weight:400;letter-spacing:0.1em;text-transform:uppercase;vertical-align:middle;margin-left:6px;">Management</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Thin accent line -->
                  <tr>
                    <td style="background-color:#A0604E;height:2px;line-height:2px;font-size:2px;">&nbsp;</td>
                  </tr>

                  <!-- BODY -->
                  <tr>
                    <td style="padding:48px 40px 40px;">
                      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#A0604E;">Operational Ledger</p>
                      <h1 style="margin:0 0 24px;font-size:26px;font-weight:700;color:#1a1a1a;letter-spacing:-0.02em;line-height:1.2;">Detailed Report Ready</h1>
                      
                      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#4a4a4a;">
                        Hello,
                      </p>
                      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#4a4a4a;">
                        The detailed Swiss Side Training Camp Operations &amp; Inventory Statement requested by <strong>${requesterName}</strong> has been successfully compiled and is attached directly to this message.
                      </p>
                      <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#4a4a4a;">
                        This document contains the comprehensive ledger lists: system-critical zero stock alerts, low-stock reorder thresholds, pending maintenance logs, open procurement requisitions, and current month transactional activity metrics.
                      </p>

                      <!-- Expiry notice -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                        <tr>
                          <td style="background-color:#f9f7f5;border-left:3px solid #A0604E;padding:14px 18px;border-radius:0 3px 3px 0;">
                            <p style="margin:0;font-size:13px;color:#666;line-height:1.5;">
                              You can download and store the attached PDF ledger directly on your local device. If you did not request this ledger statement, please report it to your system administrator.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Divider -->
                  <tr>
                    <td style="padding:0 40px;">
                      <div style="border-top:1px solid #ede9e5;"></div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color:#f9f7f5;border-top:1px solid #ede9e5;padding:16px 40px;text-align:center;">
                      <span style="font-size:10px;color:#bbb;letter-spacing:0.1em;text-transform:uppercase;">Swiss Side Training Camp &mdash; Iten, Kenya</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const pdfFilename = `Swiss_Side_Report_${dateStr.replace(/\//g, '-')}.pdf`;
      await sendDetailedReportWithAttachment(email, subject, subject, detailedEmailHtml, pdfBuffer, pdfFilename);

      return res.json({ success: true, message: `Detailed PDF report successfully generated and sent to ${email}` });
    }

    // Otherwise format === 'summary', generate HTML report as body (Strictly Emoji-Free!)
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Swiss Side System Statement</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f4f1ee;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ee;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e0dbd6;box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                
                <!-- HEADER -->
                <tr>
                  <td align="center" style="background-color:#1a1a1a;padding:40px 40px;">
                    <img src="https://swiss-side.store/logo.png" alt="Swiss Side Logo" width="100" style="display:block;margin-bottom:20px;border-radius:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <div style="width:8px;height:8px;background-color:#A0604E;border-radius:50%;display:inline-block;margin-right:10px;vertical-align:middle;"></div>
                          <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;vertical-align:middle;">Swiss Side</span>
                          <span style="color:#666;font-size:13px;font-weight:400;letter-spacing:0.1em;text-transform:uppercase;vertical-align:middle;margin-left:6px;">Management</span>
                        </td>
                      </tr>
                    </table>
                    <div style="color:#ffffff;font-size:18px;font-weight:700;margin-top:15px;text-transform:uppercase;letter-spacing:0.05em;">Swiss Side Inventory Report</div>
                    <div style="color:#888888;font-size:12px;margin-top:5px;">Run Date: ${dateStr} | Requested by: ${requesterName}</div>
                  </td>
                </tr>
                <!-- Thin accent line -->
                <tr>
                  <td style="background-color:#A0604E;height:2px;line-height:2px;font-size:2px;">&nbsp;</td>
                </tr>

                <tr>
                  <td style="padding:40px;">
                    
                    <!-- SECTION 2 — CRITICAL ALERTS -->
                    <h3 style="margin:0 0 15px;font-size:14px;font-weight:700;text-transform:uppercase;color:#991b1b;border-bottom:1px solid #eee;padding-bottom:5px;">1. Critical Alerts (Zero Stock)</h3>
                    ${zeroStock.length > 0 ? `
                      <table width="100%" cellpadding="8" cellspacing="0" style="font-size:13px;color:#4a4a4a;margin-bottom:30px;border-collapse:collapse;">
                        <thead>
                          <tr style="background-color:#f9f9f9;text-align:left;">
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;">Item Description</th>
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;">Department</th>
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;text-align:right;">Stock Level</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${zeroStock.map(row => `
                            <tr style="background-color:#FCEBEB;">
                              <td style="border-bottom:1px solid #eee;padding:8px;color:#A32D2D;font-weight:bold;">${row.name}</td>
                              <td style="border-bottom:1px solid #eee;padding:8px;color:#A32D2D;">${row.module}</td>
                              <td align="right" style="border-bottom:1px solid #eee;padding:8px;font-weight:700;color:#A32D2D;">0 ${row.unit || 'pcs'}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    ` : `
                      <p style="font-size:13px;color:#15803d;background-color:#f0fdf4;padding:10px;border-radius:4px;margin-bottom:30px;font-weight:bold;">
                        OK - All systems healthy. No inventory items are currently at zero stock.
                      </p>
                    `}


                    <!-- SECTION 3 — LOW STOCK WARNINGS -->
                    <h3 style="margin:20px 0 15px;font-size:14px;font-weight:700;text-transform:uppercase;color:#854F0B;border-bottom:1px solid #eee;padding-bottom:5px;">2. Low Stock Warnings</h3>
                    ${lowStock.length > 0 ? `
                      <table width="100%" cellpadding="8" cellspacing="0" style="font-size:13px;color:#4a4a4a;margin-bottom:30px;border-collapse:collapse;">
                        <thead>
                          <tr style="background-color:#f9f9f9;text-align:left;">
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;">Item Description</th>
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;">Department</th>
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;text-align:right;">Current Stock</th>
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;text-align:right;">Reorder Level</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${lowStock.map(row => `
                            <tr style="background-color:#FAEEDA;">
                              <td style="border-bottom:1px solid #eee;padding:8px;color:#633806;font-weight:bold;">${row.name}</td>
                              <td style="border-bottom:1px solid #eee;padding:8px;color:#633806;">${row.module}</td>
                              <td align="right" style="border-bottom:1px solid #eee;padding:8px;font-weight:700;color:#633806;">${row.quantity} ${row.unit || 'pcs'}</td>
                              <td align="right" style="border-bottom:1px solid #eee;padding:8px;color:#633806;">${row.reorder_level} ${row.unit || 'pcs'}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    ` : `
                      <p style="font-size:13px;color:#15803d;background-color:#f0fdf4;padding:10px;border-radius:4px;margin-bottom:30px;font-weight:bold;">
                        OK - All stock levels are currently above reorder thresholds.
                      </p>
                    `}


                    <!-- SECTION 4 — PENDING MAINTENANCE -->
                    <h3 style="margin:20px 0 15px;font-size:14px;font-weight:700;text-transform:uppercase;color:#1a1a1a;border-bottom:1px solid #eee;padding-bottom:5px;">3. Pending Maintenance Log</h3>
                    ${pendingMaint.length > 0 ? `
                      <table width="100%" cellpadding="8" cellspacing="0" style="font-size:13px;color:#4a4a4a;margin-bottom:30px;border-collapse:collapse;">
                        <thead>
                          <tr style="background-color:#f9f9f9;text-align:left;">
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;">Equipment / Item</th>
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;">Department</th>
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;">Issue Description</th>
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;text-align:right;">Days Open</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${pendingMaint.map(row => `
                            <tr>
                              <td style="border-bottom:1px solid #eee;padding:8px;font-weight:700;">${row.item}</td>
                              <td style="border-bottom:1px solid #eee;padding:8px;">${row.module}</td>
                              <td style="border-bottom:1px solid #eee;padding:8px;">${row.description}</td>
                              <td align="right" style="border-bottom:1px solid #eee;padding:8px;${row.days_open >= 7 ? 'color:#991b1b;font-weight:bold;' : ''}">
                                ${row.days_open} day(s)
                              </td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    ` : `
                      <p style="font-size:13px;color:#4a4a4a;background-color:#f9f9f9;padding:10px;border-radius:4px;margin-bottom:30px;">
                        No pending maintenance tickets in the queue.
                      </p>
                    `}


                    <!-- SECTION 5 — PENDING REQUISITIONS -->
                    <h3 style="margin:20px 0 15px;font-size:14px;font-weight:700;text-transform:uppercase;color:#1a1a1a;border-bottom:1px solid #eee;padding-bottom:5px;">4. Requisitions Status Overview</h3>
                    <p style="font-size:13px;color:#4a4a4a;margin-bottom:15px;font-weight:bold;">
                      Queue Summary: <span style="color:#d97706;">${pendingCount} Pending</span> | <span style="color:#2563eb;">${approvedCount} Approved</span> | <span style="color:#059669;">${orderedCount} Ordered</span>
                    </p>
                    ${highUrgencyNeeds.length > 0 ? `
                      <div style="font-size:12px;font-weight:bold;color:#991b1b;margin-bottom:8px;text-transform:uppercase;">Critical & High Urgency Requests:</div>
                      <table width="100%" cellpadding="8" cellspacing="0" style="font-size:13px;color:#4a4a4a;margin-bottom:30px;border-collapse:collapse;">
                        <thead>
                          <tr style="background-color:#f9f9f9;text-align:left;">
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;">Requested Item</th>
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;">Status</th>
                            <th style="font-weight:700;border-bottom:1px solid #eee;padding:8px;color:#1a1a1a;text-align:right;">Estimated Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${highUrgencyNeeds.map(row => `
                            <tr>
                              <td style="border-bottom:1px solid #eee;padding:8px;font-weight:700;color:#991b1b;">${row.item}</td>
                              <td style="border-bottom:1px solid #eee;padding:8px;text-transform:capitalize;">${row.status}</td>
                              <td align="right" style="border-bottom:1px solid #eee;padding:8px;font-weight:bold;">${row.currency} ${parseFloat(row.estimated_price).toLocaleString()}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    ` : `
                      <p style="font-size:13px;color:#4a4a4a;background-color:#f9f9f9;padding:10px;border-radius:4px;margin-bottom:30px;">
                        No critical or high urgency requisitions currently open.
                      </p>
                    `}


                    <!-- SECTION 6 — MOVEMENT SUMMARY -->
                    <h3 style="margin:20px 0 15px;font-size:14px;font-weight:700;text-transform:uppercase;color:#1a1a1a;border-bottom:1px solid #eee;padding-bottom:5px;">5. Monthly Activity Volume Ledger</h3>
                    <table width="100%" cellpadding="8" cellspacing="0" style="font-size:13px;color:#4a4a4a;border-collapse:collapse;">
                      <thead>
                        <tr style="background-color:#1a1a1a;color:#ffffff;text-align:left;">
                          <th style="font-weight:700;padding:8px;">Department Module</th>
                          <th style="font-weight:700;padding:8px;text-align:right;">Withdrawal Tx</th>
                          <th style="font-weight:700;padding:8px;text-align:right;">Restock Tx</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${movementSummary.map(row => `
                          <tr>
                            <td style="border-bottom:1px solid #eee;padding:8px;font-weight:700;">${row.module} Inventory</td>
                            <td align="right" style="border-bottom:1px solid #eee;padding:8px;">${row.withdrawals} txn(s)</td>
                            <td align="right" style="border-bottom:1px solid #eee;padding:8px;">${row.restocks} txn(s)</td>
                          </tr>
                        `).join('')}
                      </tbody>
                      <tfoot>
                        <tr style="background-color:#f9f9f9;font-weight:700;">
                          <td style="padding:10px;color:#1a1a1a;">TOTAL SYSTEM TRANSACTIONS</td>
                          <td align="right" style="padding:10px;color:#1a1a1a;">${totalWithdrawalsCount} withdrawals</td>
                          <td align="right" style="padding:10px;color:#1a1a1a;">${totalRestocksCount} restocks</td>
                        </tr>
                      </tfoot>
                    </table>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color:#f9f7f5;border-top:1px solid #ede9e5;padding:16px 40px;text-align:center;">
                    <span style="font-size:10px;color:#bbb;letter-spacing:0.1em;text-transform:uppercase;">Swiss Side Training Camp &mdash; Iten, Kenya</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await sendCustomEmail(email, subject, emailHtml, emailHtml);

    res.json({ success: true, message: `HTML report successfully compiled and sent to ${email}` });
  } catch (err) {
    console.error('[Send Email Report Error]', err);
    res.status(500).json({ error: 'Failed to compile or dispatch email report.' });
  }
});

// =========================================================================
// SECTION 13 — MANUAL SHOPPING LISTS REST ROUTING
// =========================================================================

// GET /api/reports/shopping-lists — List all shopping lists
router.get('/shopping-lists', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM shopping_lists ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/reports/shopping-lists — Create a new named shopping list
router.post('/shopping-lists', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Shopping list name is required.' });
  try {
    const [result] = await pool.query('INSERT INTO shopping_lists (name, status) VALUES (?, "Draft")', [name]);
    res.status(201).json({ id: result.insertId, name, status: 'Draft' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/shopping-lists/:id — Get shopping list and its items
router.get('/shopping-lists/:id', async (req, res) => {
  try {
    const [lists] = await pool.query('SELECT * FROM shopping_lists WHERE id = ?', [req.params.id]);
    const list = lists[0];
    if (!list) return res.status(404).json({ error: 'Shopping list not found.' });

    const [items] = await pool.query('SELECT * FROM shopping_list_items WHERE list_id = ? ORDER BY department, name', [req.params.id]);
    list.items = items;
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/reports/shopping-lists/:id — Update list details (e.g. status)
router.put('/shopping-lists/:id', async (req, res) => {
  const { name, status } = req.body;
  try {
    const [lists] = await pool.query('SELECT * FROM shopping_lists WHERE id = ?', [req.params.id]);
    if (!lists.length) return res.status(404).json({ error: 'Shopping list not found.' });

    let sql = 'UPDATE shopping_lists SET id = id';
    const params = [];
    if (name) { sql += ', name = ?'; params.push(name); }
    if (status) { sql += ', status = ?'; params.push(status); }
    sql += ' WHERE id = ?';
    params.push(req.params.id);

    await pool.query(sql, params);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/reports/shopping-lists/:id — Delete a list (items deleted cascade)
router.delete('/shopping-lists/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM shopping_lists WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/reports/shopping-lists/:id/items — Add item to list
router.post('/shopping-lists/:id/items', async (req, res) => {
  const suggested_quantity = req.body.suggested_quantity !== undefined ? req.body.suggested_quantity : req.body.quantity;
  const { name, department, unit, price_per_unit, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Item name is required.' });

  const qty = suggested_quantity || 1;
  const price = price_per_unit || 0;
  const total = qty * price;

  try {
    const [result] = await pool.query(
      `INSERT INTO shopping_list_items (list_id, name, department, suggested_quantity, unit, price_per_unit, total_cost, is_manual, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [req.params.id, name, department || 'General', qty, unit || 'pcs', price, total, notes || null]
    );
    res.status(201).json({ id: result.insertId, name, department, suggested_quantity: qty, unit, price_per_unit: price, total_cost: total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/reports/shopping-lists/:id/items/:itemId — Delete item from list
router.delete('/shopping-lists/:id/items/:itemId', async (req, res) => {
  try {
    await pool.query('DELETE FROM shopping_list_items WHERE list_id = ? AND id = ?', [req.params.id, req.params.itemId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/reports/shopping-lists/:id/items/:itemId/purchase
router.patch('/shopping-lists/:id/items/:itemId/purchase', async (req, res) => {
  const actual_price_paid = req.body.actual_price_paid !== undefined ? req.body.actual_price_paid : req.body.price_paid;
  const { notes } = req.body;
  
  let actualPricePaid = actual_price_paid;
  if (actualPricePaid === undefined) {
    actualPricePaid = 0;
  }
  const actualPrice = parseFloat(actualPricePaid);
  if (isNaN(actualPrice) || actualPrice < 0) {
    return res.status(400).json({ error: 'Valid actual price paid is required (must be >= 0).' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch item
    const [items] = await connection.query(
      'SELECT * FROM shopping_list_items WHERE list_id = ? AND id = ?',
      [req.params.id, req.params.itemId]
    );
    if (!items.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Procurement item not found.' });
    }
    const item = items[0];

    const suggestedQty = item.suggested_quantity || 1;
    const totalPaid = actualPrice * suggestedQty;

    // 2. Mark item as purchased
    await connection.query(
      `UPDATE shopping_list_items
       SET purchased = 1,
           purchased_by = ?,
           purchased_at = NOW(),
           actual_price_paid = ?,
           total_cost = ?,
           notes = COALESCE(?, notes)
       WHERE id = ?`,
      [req.user.id, actualPrice, totalPaid, notes || null, item.id]
    );

    // 3. Automate replenishment in respective department
    const dept = (item.department || '').trim().toLowerCase();
    
    const tableMapping = {
      kitchen: { items: 'kitchen_items', trans: 'kitchen_transactions', key: 'item_id' },
      spa: { items: 'spa_items', trans: 'spa_transactions', key: 'item_id' },
      shop: { items: 'shop_items', trans: 'shop_transactions', key: 'item_id' },
      gym: { items: 'gym_inventory', trans: 'gym_transactions', key: 'item_id' },
      supplies: { items: 'supplies_items', trans: 'supplies_transactions', key: 'item_id' },
      laundry: { items: 'laundry_items', trans: 'laundry_transactions', key: 'item_id' }
    };

    const target = tableMapping[dept];
    if (target) {
      // Find matching item by lowercase name
      const [invItems] = await connection.query(
        `SELECT id FROM \`${target.items}\` WHERE LOWER(name) = LOWER(?) AND is_active = 1 LIMIT 1`,
        [item.name]
      );
      
      if (invItems.length) {
        const invItemId = invItems[0].id;
        // Restock quantity
        await connection.query(
          `UPDATE \`${target.items}\` SET quantity = quantity + ?, last_restocked_at = NOW() WHERE id = ?`,
          [suggestedQty, invItemId]
        );
        // Log transaction record
        await connection.query(
          `INSERT INTO \`${target.trans}\` (${target.key}, action, quantity, transaction_date, reason, action_by)
           VALUES (?, 'restock', ?, CURDATE(), ?, ?)`,
          [invItemId, suggestedQty, `Automated procurement restock: List #${req.params.id}`, req.user.id]
        );
      } else {
        // If an item is missing, log a restock_failed transaction.
        // To bypass foreign key constraints safely, SET FOREIGN_KEY_CHECKS = 0; insert item_id = 0, action = 'restock_failed'; SET FOREIGN_KEY_CHECKS = 1;
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query(
          `INSERT INTO \`${target.trans}\` (${target.key}, action, quantity, transaction_date, reason, action_by)
           VALUES (0, 'restock_failed', ?, CURDATE(), ?, ?)`,
          [suggestedQty, `Failed restock: Item '${item.name}' not found in ${item.department} inventory`, req.user.id]
        );
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      }
    }

    const [[{ count }]] = await connection.query(
      'SELECT COUNT(*) as count FROM shopping_list_items WHERE list_id = ? AND purchased = 0',
      [req.params.id]
    ).catch(() => [[{ count: 1 }]]); // if column missing, don't auto-complete list
    if (count === 0) {
      await connection.query(
        'UPDATE shopping_lists SET status = "Completed", completed_at = NOW() WHERE id = ?',
        [req.params.id]
      );
    } else {
      await connection.query(
        'UPDATE shopping_lists SET status = "Active", completed_at = NULL WHERE id = ?',
        [req.params.id]
      );
    }

    await connection.commit();
    res.json({ success: true, allCompleted: count === 0 });
  } catch (err) {
    await connection.rollback();
    console.error('[Purchase Error]', err);
    res.status(500).json({ error: 'Server transaction failure.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
