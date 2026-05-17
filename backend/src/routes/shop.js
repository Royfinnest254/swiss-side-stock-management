const router = require('express').Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/items', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM shop_items WHERE is_active = 1 ORDER BY category, name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/items', async (req, res) => {
  const { name, category, quantity, unit, reorder_level, notes, is_folder, parent_id, classification } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO shop_items (name, category, quantity, unit, reorder_level, notes, is_folder, parent_id, classification) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, category, quantity || 0, unit || 'pcs', reorder_level || 0, notes || null, is_folder ? 1 : 0, parent_id || null, classification || null]
    );
    await pool.query(
      'INSERT INTO shop_transactions (item_id, action, quantity, transaction_date, action_by) VALUES (?, "added", ?, CURDATE(), ?)',
      [result.insertId, quantity || 0, req.user.id]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/items/:id', async (req, res) => {
  const { name, category, unit, reorder_level, notes, quantity, is_folder, parent_id, classification } = req.body;
  try {
    await pool.query(
      'UPDATE shop_items SET name = ?, category = ?, unit = ?, reorder_level = ?, notes = ?, quantity = ?, is_folder = ?, parent_id = ?, classification = ? WHERE id = ?',
      [name, category, unit || 'pcs', reorder_level || 0, notes || null, quantity || 0, is_folder ? 1 : 0, parent_id || null, classification || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/items/:id', async (req, res) => {
  try {
    await pool.query('UPDATE shop_items SET is_active = 0, deleted_by = ?, deleted_at = NOW() WHERE id = ?', [req.user.id, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/withdraw', async (req, res) => {
  const { item_id, quantity, reason } = req.body;
  const qty = parseInt(quantity);
  
  if (!item_id || isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Valid Item ID and quantity are required.' });
  }

  try {
    const [items] = await pool.query('SELECT quantity FROM shop_items WHERE id = ? AND is_active = 1', [item_id]);
    if (!items.length) return res.status(404).json({ error: 'Item not found.' });
    if (parseInt(items[0].quantity) < qty) return res.status(400).json({ error: 'Insufficient stock.' });

    await pool.query('UPDATE shop_items SET quantity = quantity - ?, last_withdrawn_at = NOW() WHERE id = ? AND quantity >= ?', [qty, item_id, qty]);
    const [[{ remaining }]] = await pool.query('SELECT quantity as remaining FROM shop_items WHERE id = ?', [item_id]);
    if (remaining === undefined) return res.status(404).json({ error: 'Item not found.' });
    await pool.query(
      'INSERT INTO shop_transactions (item_id, action, quantity, transaction_date, reason, action_by) VALUES (?, "withdraw", ?, CURDATE(), ?, ?)',
      [item_id, qty, reason || null, req.user.id]
    );
    const [updated] = await pool.query('SELECT * FROM shop_items WHERE id = ?', [item_id]);
    res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error('[Shop Withdraw Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/restock', async (req, res) => {
  const { item_id, quantity, reason, transaction_date } = req.body;
  const qty = parseInt(quantity);
  
  if (!item_id || isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Valid Item ID and quantity are required.' });
  }

  try {
    if (transaction_date) {
      const selectedDate = new Date(transaction_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) return res.status(400).json({ error: 'Restock date cannot be in the future.' });
    }

    await pool.query('UPDATE shop_items SET quantity = quantity + ?, last_restocked_at = NOW() WHERE id = ?', [qty, item_id]);
    await pool.query(
      'INSERT INTO shop_transactions (item_id, action, quantity, transaction_date, reason, action_by) VALUES (?, "restock", ?, COALESCE(?, CURDATE()), ?, ?)',
      [item_id, qty, transaction_date || null, reason || null, req.user.id]
    );
    const [updated] = await pool.query('SELECT * FROM shop_items WHERE id = ?', [item_id]);
    res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error('[Shop Restock Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/transactions', async (req, res) => {
  const { category, action, from_date, to_date, item_id } = req.query;
  let sql = `
    SELECT t.*, i.name as item_name, i.category, u.display_name as action_by_name
    FROM shop_transactions t
    JOIN shop_items i ON t.item_id = i.id
    LEFT JOIN users u ON t.action_by = u.id
    WHERE 1=1
  `;
  const params = [];
  if (category) { sql += ' AND i.category = ?'; params.push(category); }
  if (action) { sql += ' AND t.action = ?'; params.push(action); }
  if (from_date) { sql += ' AND t.transaction_date >= ?'; params.push(from_date); }
  if (to_date) { sql += ' AND t.transaction_date <= ?'; params.push(to_date); }
  if (item_id) { sql += ' AND t.item_id = ?'; params.push(item_id); }
  sql += ' ORDER BY t.created_at DESC LIMIT 200';
  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
