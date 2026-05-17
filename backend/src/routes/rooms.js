const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');

// GET /api/rooms
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM rooms ORDER BY name');
    res.json(rows.map(r => ({ ...r, _id: r.id })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/rooms/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Room not found.' });
    res.json({ ...rows[0], _id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/rooms — Create room + auto-populate from room_templates
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { name, type, status, notes, needs } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Name and type required.' });

    const [result] = await conn.query(
      'INSERT INTO rooms (name, type, status, notes, needs) VALUES (?, ?, ?, ?, ?)',
      [name, type, status || 'Ready', notes || null, needs || null]
    );
    const roomId = result.insertId;

    // Auto-populate from templates
    const [templates] = await conn.query('SELECT * FROM room_templates');
    for (const t of templates) {
      await conn.query(
        'INSERT INTO room_items (room_id, item_name, `condition`, quantity, notes) VALUES (?, ?, ?, ?, ?)',
        [roomId, t.item_name, 'Excellent', t.quantity, 'Standard essential item']
      );
    }

    await conn.commit();
    res.json({ _id: roomId, name, type, status: status || 'Ready' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    conn.release();
  }
});

// PATCH /api/rooms/:id
router.patch('/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    const { name, type, status, notes, needs } = req.body;
    await pool.query(
      'UPDATE rooms SET name = ?, type = ?, status = ?, notes = ?, needs = ? WHERE id = ?',
      [name, type, status, notes || null, needs || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/rooms/:id — Cascade deletes room_items via FK
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
