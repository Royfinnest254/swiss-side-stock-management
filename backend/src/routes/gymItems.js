const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');

// GET /api/gym-items
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM gym_items ORDER BY name');
    res.json(rows.map(r => ({ ...r, _id: r.id, lastChecked: r.last_checked })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/gym-items
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, condition, quantity, lastChecked, notes } = req.body;
    if (!name || !condition) return res.status(400).json({ error: 'Name and condition required.' });
    const [result] = await pool.query(
      'INSERT INTO gym_items (name, `condition`, quantity, last_checked, notes) VALUES (?, ?, ?, ?, ?)',
      [name, condition, quantity || 1, lastChecked || null, notes || null]
    );
    res.json({ _id: result.insertId, name, condition, quantity: quantity || 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/gym-items/:id
router.patch('/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    const { name, condition, quantity, lastChecked, notes } = req.body;
    await pool.query(
      'UPDATE gym_items SET name = ?, `condition` = ?, quantity = ?, last_checked = ?, notes = ? WHERE id = ?',
      [name, condition, quantity, lastChecked || null, notes || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/gym-items/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM gym_items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
