const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);

// PROPERTIES — Full Manual CRUD
router.get('/properties', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*,
        COUNT(DISTINCT h.id) as house_count,
        COUNT(DISTINCT CASE WHEN hi.condition_status IN ('needs_attention','broken','missing') AND hi.is_active = 1 THEN hi.id END) as issue_count
      FROM accommodation_properties p
      LEFT JOIN accommodation_houses h ON h.property_id = p.id AND h.is_active = 1
      LEFT JOIN accommodation_house_items hi ON hi.house_id = h.id AND hi.is_active = 1
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY p.name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/properties', requireAdmin, async (req, res) => {
  const { name, property_code } = req.body;
  if (!name) return res.status(400).json({ error: 'Property name required.' });
  try {
    await pool.query(
      'INSERT INTO accommodation_properties (name, property_code) VALUES (?, ?)',
      [name, property_code || null]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/properties/:id', requireAdmin, async (req, res) => {
  const { name, property_code } = req.body;
  try {
    await pool.query(
      'UPDATE accommodation_properties SET name = ?, property_code = ? WHERE id = ?',
      [name, property_code || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/properties/:id', requireAdmin, async (req, res) => {
  try {
    // FIX #21: Soft Delete for properties
    const [houses] = await pool.query('SELECT id FROM accommodation_houses WHERE property_id = ? AND is_active = 1 LIMIT 1', [req.params.id]);
    if (houses.length > 0) return res.status(400).json({ error: 'Cannot delete property with active houses.' });
    
    await pool.query('UPDATE accommodation_properties SET is_active = 0, deleted_by = ?, deleted_at = NOW() WHERE id = ?', [req.user.id, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// HOUSES
router.get('/houses', async (req, res) => {
  const { property_id } = req.query;
  try {
    let sql = `
      SELECT h.*,
        COUNT(DISTINCT hi.id) as item_count,
        COUNT(DISTINCT CASE WHEN hi.condition_status IN ('needs_attention','broken','missing') AND hi.is_active = 1 THEN hi.id END) as issue_count
      FROM accommodation_houses h
      LEFT JOIN accommodation_house_items hi ON hi.house_id = h.id AND hi.is_active = 1
      WHERE h.is_active = 1
    `;
    const params = [];
    if (property_id) { 
      sql += ' AND h.property_id = ?'; 
      params.push(property_id); 
    }
    sql += ' GROUP BY h.id ORDER BY h.name';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/houses/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM accommodation_houses WHERE id = ? AND is_active = 1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'House not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/houses', requireAdmin, async (req, res) => {
  const { property_id, house_name, house_number, notes } = req.body;
  if (!property_id || !house_name) return res.status(400).json({ error: 'Property and house name required.' });
  try {
    await pool.query(
      'INSERT INTO accommodation_houses (property_id, name, number, notes) VALUES (?, ?, ?, ?)',
      [property_id, house_name, house_number || null, notes || null]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/houses/:id', requireAdmin, async (req, res) => {
  const { house_name, house_number, notes } = req.body;
  try {
    await pool.query(
      'UPDATE accommodation_houses SET name = ?, number = ?, notes = ? WHERE id = ?',
      [house_name, house_number || null, notes || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/houses/:id', requireAdmin, async (req, res) => {
  try {
    // FIX #21: Soft Delete for houses
    await pool.query('UPDATE accommodation_houses SET is_active = 0, deleted_by = ?, deleted_at = NOW() WHERE id = ?', [req.user.id, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// HOUSE ITEMS
router.get('/houses/:id/items', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM accommodation_house_items WHERE house_id = ? AND is_active = 1 ORDER BY name',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/houses/:id/items', async (req, res) => {
  const { name, quantity, condition_status, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Item name required.' });
  try {
    await pool.query(
      'INSERT INTO accommodation_house_items (house_id, name, quantity, condition_status, notes) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, name, quantity || 1, condition_status || 'good', notes || null]
    );
    await pool.query(
      'INSERT INTO accommodation_transactions (house_id, action, description, transaction_date, action_by) VALUES (?, ?, ?, CURDATE(), ?)',
      [req.params.id, 'item_added', `Added: ${name}`, req.user.id]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/houses/:houseId/items/:itemId', async (req, res) => {
  const { name, quantity, condition_status, notes } = req.body;
  try {
    await pool.query(
      'UPDATE accommodation_house_items SET name = ?, quantity = ?, condition_status = ?, notes = ?, last_checked_at = NOW() WHERE id = ? AND house_id = ?',
      [name, quantity || 1, condition_status || 'good', notes || null, req.params.itemId, req.params.houseId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/items/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'UPDATE accommodation_house_items SET is_active = 0, deleted_by = ?, deleted_at = NOW() WHERE id = ?',
      [req.user.id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// NOTES
router.get('/houses/:id/notes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.*, u.display_name as written_by_name
       FROM accommodation_house_notes n
       LEFT JOIN users u ON n.written_by = u.id
       WHERE n.house_id = ? ORDER BY n.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/houses/:id/notes', async (req, res) => {
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'Note text required.' });
  try {
    await pool.query(
      'INSERT INTO accommodation_house_notes (house_id, note, written_by) VALUES (?, ?, ?)',
      [req.params.id, note, req.user.id]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ROOMS COMPATIBILITY LAYER FOR FRONTEND
// Auto-update table schema if columns are missing
const ensureRoomColumns = async () => {
  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM accommodation_houses");
    const colNames = columns.map(c => c.Field);

    if (!colNames.includes('room_number')) {
      await pool.query("ALTER TABLE accommodation_houses ADD COLUMN room_number VARCHAR(50) NULL");
    }
    if (!colNames.includes('room_type')) {
      await pool.query("ALTER TABLE accommodation_houses ADD COLUMN room_type VARCHAR(50) DEFAULT 'Single'");
    }
    if (!colNames.includes('capacity')) {
      await pool.query("ALTER TABLE accommodation_houses ADD COLUMN capacity INT DEFAULT 1");
    }
    if (!colNames.includes('status')) {
      await pool.query("ALTER TABLE accommodation_houses ADD COLUMN status VARCHAR(50) DEFAULT 'available'");
    }
    if (!colNames.includes('guest_name')) {
      await pool.query("ALTER TABLE accommodation_houses ADD COLUMN guest_name VARCHAR(255) NULL");
    }
    if (!colNames.includes('check_in_date')) {
      await pool.query("ALTER TABLE accommodation_houses ADD COLUMN check_in_date VARCHAR(50) NULL");
    }
    if (!colNames.includes('is_active')) {
      await pool.query("ALTER TABLE accommodation_houses ADD COLUMN is_active TINYINT(1) DEFAULT 1");
    }
    // Set all existing NULL active statuses to 1 to prevent hidden rooms
    await pool.query("UPDATE accommodation_houses SET is_active = 1 WHERE is_active IS NULL");
  } catch (err) {
    console.error("Error ensuring room columns exist:", err);
  }
};
// Trigger column check asynchronously (delayed to prevent startup connection collision)
setTimeout(() => {
  ensureRoomColumns();
}, 10000);

router.get('/rooms', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT h.id, h.property_id, h.name as house_name, p.name as property_name,
             COALESCE(h.room_number, h.number, '') as room_number,
             COALESCE(h.room_type, 'Single') as room_type,
             COALESCE(h.capacity, 1) as capacity,
             COALESCE(h.status, 'available') as status,
             h.guest_name, h.check_in_date, h.notes
      FROM accommodation_houses h
      LEFT JOIN accommodation_properties p ON h.property_id = p.id
      WHERE h.is_active = 1
      ORDER BY room_number, h.id
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/rooms', async (req, res) => {
  const { room_number, room_type, capacity, status, notes } = req.body;
  try {
    let [props] = await pool.query("SELECT id FROM accommodation_properties WHERE is_active = 1 LIMIT 1");
    let propId = props.length > 0 ? props[0].id : null;
    if (!propId) {
      const [insertRes] = await pool.query("INSERT INTO accommodation_properties (name, property_code) VALUES ('Main Property', 'MP')");
      propId = insertRes.insertId;
    }

    const [result] = await pool.query(`
      INSERT INTO accommodation_houses 
        (property_id, name, number, room_number, room_type, capacity, status, notes, is_active) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      propId, 
      `Room ${room_number}`, 
      room_number, 
      room_number, 
      room_type || 'Single', 
      capacity || 1, 
      status || 'available', 
      notes || null
    ]);

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/rooms/:id', async (req, res) => {
  const { room_number, room_type, capacity, status, notes } = req.body;
  try {
    await pool.query(`
      UPDATE accommodation_houses SET 
        name = ?, 
        number = ?, 
        room_number = ?, 
        room_type = ?, 
        capacity = ?, 
        status = ?, 
        notes = ?
      WHERE id = ?
    `, [
      `Room ${room_number}`,
      room_number,
      room_number,
      room_type,
      capacity,
      status,
      notes || null,
      req.params.id
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/rooms/:id/assign', async (req, res) => {
  const { guest_name, check_in_date } = req.body;
  try {
    await pool.query(`
      UPDATE accommodation_houses SET
        guest_name = ?,
        check_in_date = ?,
        status = 'occupied'
      WHERE id = ?
    `, [guest_name, check_in_date, req.params.id]);

    const [rows] = await pool.query(`
      SELECT h.id, h.property_id, h.name as house_name, p.name as property_name,
             COALESCE(h.room_number, h.number, '') as room_number,
             COALESCE(h.room_type, 'Single') as room_type,
             COALESCE(h.capacity, 1) as capacity,
             COALESCE(h.status, 'available') as status,
             h.guest_name, h.check_in_date, h.notes
      FROM accommodation_houses h
      LEFT JOIN accommodation_properties p ON h.property_id = p.id
      WHERE h.id = ?
    `, [req.params.id]);

    res.json({ success: true, item: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/rooms/:id/checkout', async (req, res) => {
  try {
    await pool.query(`
      UPDATE accommodation_houses SET
        guest_name = NULL,
        check_in_date = NULL,
        status = 'cleaning'
      WHERE id = ?
    `, [req.params.id]);

    const [rows] = await pool.query(`
      SELECT h.id, h.property_id, h.name as house_name, p.name as property_name,
             COALESCE(h.room_number, h.number, '') as room_number,
             COALESCE(h.room_type, 'Single') as room_type,
             COALESCE(h.capacity, 1) as capacity,
             COALESCE(h.status, 'available') as status,
             h.guest_name, h.check_in_date, h.notes
      FROM accommodation_houses h
      LEFT JOIN accommodation_properties p ON h.property_id = p.id
      WHERE h.id = ?
    `, [req.params.id]);

    res.json({ success: true, item: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /rooms/:id/resident — Edit resident details
router.put('/rooms/:id/resident', async (req, res) => {
  const { guest_name, check_in_date } = req.body;
  if (!guest_name) return res.status(400).json({ error: 'Guest name is required.' });
  try {
    await pool.query(`
      UPDATE accommodation_houses SET
        guest_name = ?,
        check_in_date = ?
      WHERE id = ?
    `, [guest_name, check_in_date || null, req.params.id]);

    const [rows] = await pool.query(`
      SELECT h.id, h.property_id, h.name as house_name, p.name as property_name,
             COALESCE(h.room_number, h.number, '') as room_number,
             COALESCE(h.room_type, 'Single') as room_type,
             COALESCE(h.capacity, 1) as capacity,
             COALESCE(h.status, 'available') as status,
             h.guest_name, h.check_in_date, h.notes
      FROM accommodation_houses h
      LEFT JOIN accommodation_properties p ON h.property_id = p.id
      WHERE h.id = ?
    `, [req.params.id]);

    res.json({ success: true, item: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /rooms/:id — Delete/decommission room (Admin only)
router.delete('/rooms/:id', async (req, res) => {
  try {
    await pool.query('UPDATE accommodation_houses SET is_active = 0, deleted_by = ?, deleted_at = NOW() WHERE id = ?', [req.user.id, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
