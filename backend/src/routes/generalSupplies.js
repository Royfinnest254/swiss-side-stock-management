const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM general_supplies WHERE is_active = 1 ORDER BY category, name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/', requireStaff, async (req, res) => {
  try {
    const { name, quantity, unit, reorder_level, category, notes, is_folder, parent_id, classification } = req.body;
    if (!name || !unit || !category) return res.status(400).json({ error: 'Name, unit, and category required.' });
    const [result] = await pool.query(
      'INSERT INTO general_supplies (name, quantity, unit, reorder_level, category, notes, is_folder, parent_id, classification) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, quantity || 0, unit, reorder_level || 0, category, notes || null, is_folder ? 1 : 0, parent_id || null, classification || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/:id', requireStaff, async (req, res) => {
  try {
    const { name, quantity, unit, reorder_level, category, notes, is_folder, parent_id, classification } = req.body;
    await pool.query(
      'UPDATE general_supplies SET name = ?, quantity = ?, unit = ?, reorder_level = ?, category = ?, notes = ?, is_folder = ?, parent_id = ?, classification = ? WHERE id = ?',
      [name, quantity, unit, reorder_level, category, notes || null, is_folder ? 1 : 0, parent_id || null, classification || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE general_supplies SET is_active = 0, deleted_by = ?, deleted_at = NOW() WHERE id = ?', [req.user.id, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Feature 4, 5, 6: Transactional Endpoints
router.post('/withdraw', requireStaff, async (req, res) => {
  const { item_id, quantity, reason } = req.body;
  const qty = parseFloat(quantity);
  if (!item_id || isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid ID/quantity.' });

  try {
    const [items] = await pool.query('SELECT quantity FROM general_supplies WHERE id = ? AND is_active = 1', [item_id]);
    if (!items.length) return res.status(404).json({ error: 'Item not found.' });
    if (parseFloat(items[0].quantity) < qty) return res.status(400).json({ error: 'Insufficient stock.' });

    await pool.query('UPDATE general_supplies SET quantity = quantity - ? WHERE id = ? AND quantity >= ?', [qty, item_id, qty]);
    const [[{ remaining }]] = await pool.query('SELECT quantity as remaining FROM general_supplies WHERE id = ?', [item_id]);
    if (remaining === undefined) return res.status(404).json({ error: 'Item not found.' });
    // Use generic transactions table if module-specific doesn't exist
    await pool.query(
      'INSERT INTO transactions (item_id, item_source, item_name, type, quantity, unit, person, notes) SELECT ?, "general_supplies", name, "WITHDRAWAL", ?, unit, ?, ? FROM general_supplies WHERE id = ?',
      [item_id, qty, req.user.display_name || req.user.email, reason || null, item_id]
    );
    const [updated] = await pool.query('SELECT * FROM general_supplies WHERE id = ?', [item_id]);
    res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/restock', requireStaff, async (req, res) => {
  const { item_id, quantity, reason, transaction_date } = req.body;
  const qty = parseFloat(quantity);
  if (!item_id || isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid ID/quantity.' });

  try {
    await pool.query('UPDATE general_supplies SET quantity = quantity + ? WHERE id = ?', [qty, item_id]);
    await pool.query(
      'INSERT INTO transactions (item_id, item_source, item_name, type, quantity, unit, person, notes, created_at) SELECT ?, "general_supplies", name, "RESTOCK", ?, unit, ?, ?, COALESCE(?, NOW()) FROM general_supplies WHERE id = ?',
      [item_id, qty, req.user.display_name || req.user.email, reason || null, transaction_date || null, item_id]
    );
    const [updated] = await pool.query('SELECT * FROM general_supplies WHERE id = ?', [item_id]);
    res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
