const router = require('express').Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const [stock] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN quantity < reorder_level AND reorder_level > 0 THEN 1 ELSE 0 END) as low_stock
      FROM (
        SELECT quantity, reorder_level FROM kitchen_items WHERE is_active = 1
        UNION ALL
        SELECT quantity, reorder_level FROM spa_items WHERE is_active = 1
        UNION ALL
        SELECT quantity, reorder_level FROM shop_items WHERE is_active = 1
        UNION ALL
        SELECT quantity, reorder_level FROM supplies_items WHERE is_active = 1
        UNION ALL
        SELECT quantity, reorder_level FROM laundry_items WHERE is_active = 1
        UNION ALL
        SELECT quantity, reorder_level FROM gym_inventory WHERE is_active = 1
      ) combined
    `).catch(() => [[{ total: 0, low_stock: 0 }]]);

    const [[mKit], [mSpa], [mGym], [mShop], [mSupp], [mLau], [mNeeds]] = await Promise.all([
      pool.query("SELECT COUNT(*) as c FROM kitchen_maintenance WHERE status = 'pending'").catch(() => [[{ c: 0 }]]),
      pool.query("SELECT COUNT(*) as c FROM spa_maintenance WHERE status = 'pending'").catch(() => [[{ c: 0 }]]),
      pool.query("SELECT COUNT(*) as c FROM gym_maintenance WHERE status = 'pending'").catch(() => [[{ c: 0 }]]),
      pool.query("SELECT COUNT(*) as c FROM shop_maintenance WHERE status = 'pending'").catch(() => [[{ c: 0 }]]),
      pool.query("SELECT COUNT(*) as c FROM supplies_maintenance WHERE status = 'pending'").catch(() => [[{ c: 0 }]]),
      pool.query("SELECT COUNT(*) as c FROM laundry_maintenance WHERE status = 'pending'").catch(() => [[{ c: 0 }]]),
      pool.query("SELECT COUNT(*) as c FROM needs WHERE request_type = 'Maintenance' AND status = 'pending' AND is_active = 1").catch(() => [[{ c: 0 }]])
    ]);
    const pendingMaintenance = (mKit[0]?.c || 0) + (mSpa[0]?.c || 0) + (mGym[0]?.c || 0) + (mShop[0]?.c || 0) + (mSupp[0]?.c || 0) + (mLau[0]?.c || 0) + (mNeeds[0]?.c || 0);

    const [[reqs]] = await pool.query("SELECT COUNT(*) as c FROM needs WHERE status = 'pending' AND is_active = 1").catch(() => [[{ c: 0 }]]);
    const pendingRequests = reqs[0]?.c || 0;

    const [accommodation] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM accommodation_houses WHERE is_active = 1) as total_houses,
        (SELECT COUNT(*) FROM accommodation_house_items WHERE is_active = 1) as total_items,
        (SELECT COUNT(*) FROM accommodation_house_items 
         WHERE condition_status IN ('needs_attention','broken','missing') AND is_active = 1) as attention_needed
    `).catch(() => [[{ total_houses: 0, total_items: 0, attention_needed: 0 }]]);

    // Recent Activity from all modules transactions
    const [recentTransactions] = await pool.query(`
      (SELECT 'Kitchen' as module, i.name as item, t.action, t.quantity,
              u.display_name as action_by, t.created_at
       FROM kitchen_transactions t
       JOIN kitchen_items i ON t.item_id = i.id
       LEFT JOIN users u ON t.action_by = u.id)
      UNION ALL
      (SELECT 'Spa', i.name, t.action, t.quantity, u.display_name, t.created_at
       FROM spa_transactions t
       JOIN spa_items i ON t.item_id = i.id
       LEFT JOIN users u ON t.action_by = u.id)
      UNION ALL
      (SELECT 'Shop', i.name, t.action, t.quantity, u.display_name, t.created_at
       FROM shop_transactions t
       JOIN shop_items i ON t.item_id = i.id
       LEFT JOIN users u ON t.action_by = u.id)
      UNION ALL
      (SELECT 'Gym', i.name, t.action, t.quantity, u.display_name, t.created_at
       FROM gym_transactions t
       JOIN gym_inventory i ON t.item_id = i.id
       LEFT JOIN users u ON t.action_by = u.id)
      UNION ALL
      (SELECT 'Supplies', i.name, t.action, t.quantity, u.display_name, t.created_at
       FROM supplies_transactions t
       JOIN supplies_items i ON t.item_id = i.id
       LEFT JOIN users u ON t.action_by = u.id)
      UNION ALL
      (SELECT 'Laundry', i.name, t.action, t.quantity, u.display_name, t.created_at
       FROM laundry_transactions t
       JOIN laundry_items i ON t.item_id = i.id
       LEFT JOIN users u ON t.action_by = u.id)
      ORDER BY created_at DESC LIMIT 10
    `).catch(() => [[]]);

    res.json({
      stock: {
        total: stock[0]?.total || 0,
        low_stock: stock[0]?.low_stock || 0
      },
      maintenance: { pending: pendingMaintenance },
      requests: { pending: pendingRequests },
      accommodation: accommodation[0] || { total_houses: 0, total_items: 0, attention_needed: 0 },
      recentTransactions: Array.isArray(recentTransactions) ? recentTransactions : []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/metrics', requireAuth, async (req, res) => {
  try {
    const [
      [kitchenStats], [spaStats], [shopStats], [gymStats], [suppliesStats], [laundryStats], [accommodationStats], [requestsStats]
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN quantity < reorder_level AND reorder_level > 0 THEN 1 ELSE 0 END), 0) as low FROM kitchen_items WHERE is_active = 1').catch(() => [[{ total: 0, low: 0 }]]),
      pool.query('SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN quantity < reorder_level AND reorder_level > 0 THEN 1 ELSE 0 END), 0) as low FROM spa_items WHERE is_active = 1').catch(() => [[{ total: 0, low: 0 }]]),
      pool.query('SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN quantity < reorder_level AND reorder_level > 0 THEN 1 ELSE 0 END), 0) as low FROM shop_items WHERE is_active = 1').catch(() => [[{ total: 0, low: 0 }]]),
      pool.query('SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN quantity < reorder_level AND reorder_level > 0 THEN 1 ELSE 0 END), 0) as low FROM gym_inventory WHERE is_active = 1').catch(() => [[{ total: 0, low: 0 }]]),
      pool.query('SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN quantity < reorder_level AND reorder_level > 0 THEN 1 ELSE 0 END), 0) as low FROM supplies_items WHERE is_active = 1').catch(() => [[{ total: 0, low: 0 }]]),
      pool.query('SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN quantity < reorder_level AND reorder_level > 0 THEN 1 ELSE 0 END), 0) as low FROM laundry_items WHERE is_active = 1').catch(() => [[{ total: 0, low: 0 }]]),
      pool.query("SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN condition_status IN ('needs_attention','broken','missing') THEN 1 ELSE 0 END), 0) as low FROM accommodation_house_items WHERE is_active = 1").catch(() => [[{ total: 0, low: 0 }]]),
      pool.query("SELECT COUNT(*) as pending FROM needs WHERE status = 'pending' AND is_active = 1").catch(() => [[{ pending: 0 }]])
    ]);

    res.json({
      kitchen: { total: kitchenStats[0].total, low: parseInt(kitchenStats[0].low) },
      spa: { total: spaStats[0].total, low: parseInt(spaStats[0].low) },
      shop: { total: shopStats[0].total, low: parseInt(shopStats[0].low) },
      gym: { total: gymStats[0].total, low: parseInt(gymStats[0].low) },
      supplies: { total: suppliesStats[0].total, low: parseInt(suppliesStats[0].low) },
      laundry: { total: laundryStats[0].total, low: parseInt(laundryStats[0].low) },
      accommodation: { total: accommodationStats[0].total, low: parseInt(accommodationStats[0].low) },
      requests: { pending: requestsStats[0].pending }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/dashboard/analytics — Dynamic aggregated indicators across ranges
router.get('/analytics', requireAuth, async (req, res) => {
  const { range } = req.query;

  let dateConstraint = 'AND transaction_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  let needsConstraint = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  
  if (range === '24h') {
    dateConstraint = 'AND transaction_date >= DATE_SUB(NOW(), INTERVAL 1 DAY)';
    needsConstraint = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)';
  } else if (range === '30d') {
    dateConstraint = 'AND transaction_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    needsConstraint = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  } else if (range === '3m') {
    dateConstraint = 'AND transaction_date >= DATE_SUB(NOW(), INTERVAL 3 MONTH)';
    needsConstraint = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)';
  } else if (range === '6m') {
    dateConstraint = 'AND transaction_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)';
    needsConstraint = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)';
  } else if (range === '1y') {
    dateConstraint = 'AND transaction_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
    needsConstraint = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
  } else if (range === 'all') {
    dateConstraint = '';
    needsConstraint = '';
  }

  try {
    // 1. Total stock withdrawals in the timeframe
    const [withdrawRes] = await pool.query(`
      SELECT SUM(qty) as total FROM (
        SELECT COALESCE(SUM(quantity), 0) as qty FROM kitchen_transactions WHERE action = 'withdraw' ${dateConstraint}
        UNION ALL
        SELECT COALESCE(SUM(quantity), 0) FROM spa_transactions WHERE action = 'withdraw' ${dateConstraint}
        UNION ALL
        SELECT COALESCE(SUM(quantity), 0) FROM shop_transactions WHERE action = 'withdraw' ${dateConstraint}
        UNION ALL
        SELECT COALESCE(SUM(quantity), 0) FROM gym_transactions WHERE action = 'withdraw' ${dateConstraint}
        UNION ALL
        SELECT COALESCE(SUM(quantity), 0) FROM supplies_transactions WHERE action = 'withdraw' ${dateConstraint}
        UNION ALL
        SELECT COALESCE(SUM(quantity), 0) FROM laundry_transactions WHERE action = 'withdraw' ${dateConstraint}
      ) combined
    `);

    // 2. Total restocks in same timeframe
    const [restockRes] = await pool.query(`
      SELECT SUM(qty) as total FROM (
        SELECT COALESCE(SUM(quantity), 0) as qty FROM kitchen_transactions WHERE action = 'restock' ${dateConstraint}
        UNION ALL
        SELECT COALESCE(SUM(quantity), 0) FROM spa_transactions WHERE action = 'restock' ${dateConstraint}
        UNION ALL
        SELECT COALESCE(SUM(quantity), 0) FROM shop_transactions WHERE action = 'restock' ${dateConstraint}
        UNION ALL
        SELECT COALESCE(SUM(quantity), 0) FROM gym_transactions WHERE action = 'restock' ${dateConstraint}
        UNION ALL
        SELECT COALESCE(SUM(quantity), 0) FROM supplies_transactions WHERE action = 'restock' ${dateConstraint}
        UNION ALL
        SELECT COALESCE(SUM(quantity), 0) FROM laundry_transactions WHERE action = 'restock' ${dateConstraint}
      ) combined
    `);

    // 3. Low stock (gap) alerts - live snapshot
    const [lowStockRes] = await pool.query(`
      SELECT COUNT(*) as count FROM (
        SELECT id FROM kitchen_items WHERE quantity < reorder_level AND reorder_level > 0 AND is_active = 1
        UNION ALL
        SELECT id FROM spa_items WHERE quantity < reorder_level AND reorder_level > 0 AND is_active = 1
        UNION ALL
        SELECT id FROM shop_items WHERE quantity < reorder_level AND reorder_level > 0 AND is_active = 1
        UNION ALL
        SELECT id FROM gym_inventory WHERE quantity < reorder_level AND reorder_level > 0 AND is_active = 1
        UNION ALL
        SELECT id FROM supplies_items WHERE quantity < reorder_level AND reorder_level > 0 AND is_active = 1
        UNION ALL
        SELECT id FROM laundry_items WHERE quantity < reorder_level AND reorder_level > 0 AND is_active = 1
      ) combined
    `);

    // 4. Fulfilled requests count in timeframe
    const [fulfilledRes] = await pool.query(
      `SELECT COUNT(*) as count FROM needs WHERE status = 'fulfilled' AND is_active = 1 ${needsConstraint}`
    );

    // 5. Module Distribution ratios
    const [distributionRes] = await pool.query(`
      SELECT 'Kitchen' as name, COUNT(*) as count FROM kitchen_items WHERE is_active = 1
      UNION ALL
      SELECT 'Spa', COUNT(*) FROM spa_items WHERE is_active = 1
      UNION ALL
      SELECT 'Shop', COUNT(*) FROM shop_items WHERE is_active = 1
      UNION ALL
      SELECT 'Gym', COUNT(*) FROM gym_inventory WHERE is_active = 1
      UNION ALL
      SELECT 'Supplies', COUNT(*) FROM supplies_items WHERE is_active = 1
      UNION ALL
      SELECT 'Laundry', COUNT(*) FROM laundry_items WHERE is_active = 1
    `);

    const withdrawals = parseInt(withdrawRes[0]?.total || 0);
    const restocks = parseInt(restockRes[0]?.total || 0);
    const totalMovements = withdrawals + restocks;
    
    // Calculate movement percentage ratio (withdrawals relative to total transactions)
    const movementRate = totalMovements > 0 ? Math.round((withdrawals / totalMovements) * 100) : 0;

    res.json({
      stockTurnover: withdrawals,
      supplyGap: parseInt(lowStockRes[0]?.count || 0),
      fulfilledRequests: parseInt(fulfilledRes[0]?.count || 0),
      movementRate: `${movementRate}%`,
      distribution: distributionRes.map(row => ({
        name: row.name,
        count: parseInt(row.count || 0)
      }))
    });
  } catch (err) {
    console.error('[Dashboard Analytics Error]', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
