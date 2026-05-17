const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

/**
 * PRODUCTION NOTE (Audit #25): 
 * If you add a new module (e.g. "Pharmacy" or "Tools"), you MUST add 
 * its table to this map for it to appear in the Recycle Bin.
 */
const MODULE_TABLE_MAP = {
  kitchen:        'kitchen_items',
  spa:            'spa_items',
  shop:           'shop_items',
  gym:            'gym_inventory',
  gym_equipment:  'gym_inventory',
  gym_products:   'gym_inventory',
  supplies:       'supplies_items',
  laundry:        'laundry_items',
  accommodation:  'accommodation_house_items',
  needs:          'needs'
};

router.get('/', async (req, res) => {
  const { module, from_date, to_date } = req.query;

  const targetModules = module && MODULE_TABLE_MAP[module]
    ? { [module]: MODULE_TABLE_MAP[module] }
    : MODULE_TABLE_MAP;

  const unionParts = [];
  const params = [];

  Object.entries(targetModules).forEach(([moduleName, table]) => {
    // Standardize column name for UNION
    const nameCol = table === 'needs' ? 'item' : 'name';

    let sql = `
      SELECT
        t.id,
        t.${nameCol}   AS name,
        ?              AS module,
        t.deleted_at,
        u.display_name AS deleted_by_name
      FROM ${table} t
      LEFT JOIN users u ON t.deleted_by = u.id
      WHERE t.is_active = 0
        AND t.deleted_at IS NOT NULL
    `;
    params.push(moduleName);

    if (from_date) {
      sql += ' AND t.deleted_at >= ?';
      params.push(from_date);
    }
    if (to_date) {
      sql += ' AND t.deleted_at <= ?';
      params.push(to_date);
    }

    unionParts.push(`(${sql})`);
  });

  if (unionParts.length === 0) return res.json([]);

  const finalSql = unionParts.join(' UNION ALL ') + ' ORDER BY deleted_at DESC LIMIT 200';

  try {
    const [rows] = await pool.query(finalSql, params);
    res.json(rows);
  } catch (err) {
    console.error('[RecycleBin GET Error]', err.message);
    // FIX #11: Removed detailed error from client response
    res.status(500).json({ error: 'Failed to fetch deleted items.' });
  }
});

router.post('/restore', async (req, res) => {
  const { module, item_id } = req.body;

  const table = MODULE_TABLE_MAP[module];
  if (!table) return res.status(400).json({ error: 'Invalid module.' });

  const nameCol = table === 'needs' ? 'item' : 'name';

  try {
    const [items] = await pool.query(
      `SELECT ${nameCol} AS name FROM ${table} WHERE id = ?`,
      [item_id]
    );
    if (!items.length) return res.status(404).json({ error: 'Item not found.' });

    await pool.query(
      `UPDATE ${table} SET is_active = 1, deleted_by = NULL, deleted_at = NULL WHERE id = ?`,
      [item_id]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, "ITEM_RESTORED", ?, ?)',
      [req.user.id, module, `Restored: ${items[0].name}`]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[RecycleBin RESTORE Error]', err.message);
    // FIX #11: Removed detailed error from client response
    res.status(500).json({ error: 'Failed to restore item.' });
  }
});

module.exports = router;
