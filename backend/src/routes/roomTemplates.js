const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/room-templates
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM room_templates ORDER BY item_name');
    res.json(rows.map(r => ({ ...r, _id: r.id, itemName: r.item_name })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/room-templates
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { itemName, quantity } = req.body;
    if (!itemName) return res.status(400).json({ error: 'itemName required.' });
    const [result] = await pool.query('INSERT INTO room_templates (item_name, quantity) VALUES (?, ?)', [itemName, quantity || 1]);
    res.json({ _id: result.insertId, itemName, quantity: quantity || 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/room-templates/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM room_templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
