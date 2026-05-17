const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');

// GET /api/items
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM items ORDER BY name');
    res.json(rows.map(r => ({ ...r, _id: r.id, reorderLevel: r.reorder_level, isTest: !!r.is_test })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/items
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, unit, quantity, reorderLevel } = req.body;
    if (!name || !unit) return res.status(400).json({ error: 'Name and unit required.' });
    const [result] = await pool.query(
      'INSERT INTO items (name, unit, quantity, reorder_level) VALUES (?, ?, ?, ?)',
      [name, unit, quantity || 0, reorderLevel || 0]
    );
    res.json({ _id: result.insertId, name, unit, quantity: quantity || 0, reorderLevel: reorderLevel || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/items/:id
router.patch('/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    const { name, unit, quantity, reorderLevel } = req.body;
    await pool.query(
      'UPDATE items SET name = ?, unit = ?, quantity = ?, reorder_level = ? WHERE id = ?',
      [name, unit, quantity, reorderLevel, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/items/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
