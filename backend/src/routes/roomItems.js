const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');

// GET /api/room-items?roomId=x
router.get('/', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.query;
    let rows;
    if (roomId) {
      [rows] = await pool.query('SELECT * FROM room_items WHERE room_id = ? ORDER BY item_name', [roomId]);
    } else {
      [rows] = await pool.query('SELECT * FROM room_items ORDER BY room_id, item_name');
    }
    res.json(rows.map(r => ({ ...r, _id: r.id, roomId: r.room_id, itemName: r.item_name })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/room-items
router.post('/', requireAuth, requireStaff, async (req, res) => {
  try {
    const { roomId, itemName, condition, quantity, notes } = req.body;
    if (!roomId || !itemName || !condition) return res.status(400).json({ error: 'roomId, itemName, condition required.' });
    const [result] = await pool.query(
      'INSERT INTO room_items (room_id, item_name, `condition`, quantity, notes) VALUES (?, ?, ?, ?, ?)',
      [roomId, itemName, condition, quantity || 1, notes || null]
    );
    res.json({ _id: result.insertId, roomId, itemName, condition, quantity: quantity || 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/room-items/:id
router.patch('/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    const { itemName, condition, quantity, notes } = req.body;
    await pool.query(
      'UPDATE room_items SET item_name = ?, `condition` = ?, quantity = ?, notes = ? WHERE id = ?',
      [itemName, condition, quantity, notes || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/room-items/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM room_items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
