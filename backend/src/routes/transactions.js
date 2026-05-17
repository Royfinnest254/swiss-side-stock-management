const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');

// GET /api/transactions?page=1&limit=20
router.get('/', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM transactions');
    const [rows] = await pool.query(
      'SELECT * FROM transactions USE INDEX (idx_created_at) ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    res.json({
      results: rows.map(r => ({ ...r, _id: r.id, itemId: r.item_id, itemName: r.item_name })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + rows.length < total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/transactions/export — All history for CSV export
router.get('/export', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM transactions ORDER BY created_at DESC');
    res.json(rows.map(r => ({ ...r, _id: r.id, itemName: r.item_name })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/transactions/withdraw
router.post('/withdraw', requireAuth, requireStaff, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { itemId, itemSource, quantity, notes } = req.body;
    if (!itemId || !quantity) return res.status(400).json({ error: 'itemId and quantity required.' });

    const table = itemSource === 'general_supplies' ? 'general_supplies' : 'items';
    const [items] = await conn.query(`SELECT * FROM ${table} WHERE id = ?`, [itemId]);
    const item = items[0];
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    if (item.quantity < quantity) return res.status(400).json({ error: `Insufficient stock. Only ${item.quantity} ${item.unit} available.` });

    await conn.query(`UPDATE ${table} SET quantity = quantity - ? WHERE id = ?`, [quantity, itemId]);

    const person = (req.user.displayName || req.user.email).slice(0, 100);
    await conn.query(
      'INSERT INTO transactions (item_id, item_source, item_name, type, quantity, unit, person, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [itemId, table, item.name, 'WITHDRAWAL', quantity, item.unit, person, notes?.slice(0, 500) || null]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error.' });
  } finally {
    conn.release();
  }
});

// POST /api/transactions/restock
router.post('/restock', requireAuth, requireStaff, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { itemId, itemSource, quantity, notes } = req.body;
    if (!itemId || !quantity) return res.status(400).json({ error: 'itemId and quantity required.' });

    const table = itemSource === 'general_supplies' ? 'general_supplies' : 'items';
    const [items] = await conn.query(`SELECT * FROM ${table} WHERE id = ?`, [itemId]);
    const item = items[0];
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    await conn.query(`UPDATE ${table} SET quantity = quantity + ? WHERE id = ?`, [quantity, itemId]);

    const person = (req.user.displayName || req.user.email).slice(0, 100);
    await conn.query(
      'INSERT INTO transactions (item_id, item_source, item_name, type, quantity, unit, person, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [itemId, table, item.name, 'RESTOCK', quantity, item.unit, person, notes?.slice(0, 500) || null]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
