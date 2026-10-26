const router = require('express').Router();
const pool = require('../db');
const { resolveStaffMemberName } = require('../utils/staffMember');
const { normalizeInventoryQuantities, parsePositiveQuantity } = require('../utils/inventoryQuantity');
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
  const { name, category, unit, reorder_level, notes, is_folder, parent_id, classification, unit_price } = req.body;
  const quantityPayload = normalizeInventoryQuantities(req.body);
  if (quantityPayload.error) return res.status(400).json({ error: quantityPayload.error });
  const stockQuantity = quantityPayload.quantity;
  const openedQuantity = quantityPayload.opened_quantity_remaining;
  try {
    const [result] = await pool.query(
      'INSERT INTO shop_items (name, category, quantity, opened_quantity_remaining, unit, reorder_level, notes, is_folder, parent_id, classification, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, category, stockQuantity, openedQuantity, unit || 'pcs', reorder_level || 0, notes || null, is_folder ? 1 : 0, parent_id || null, classification || null, unit_price != null ? unit_price : null]
    );
    await pool.query(
      'INSERT INTO shop_transactions (item_id, action, quantity, unit, transaction_date, action_by, staff_member_name) VALUES (?, "added", ?, ?, CURDATE(), ?, ?)',
      [result.insertId, stockQuantity, unit || 'pcs', req.user.id, resolveStaffMemberName(req)]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/items/:id', async (req, res) => {
  const { name, category, unit, reorder_level, notes, is_folder, parent_id, classification, unit_price } = req.body;
  const quantityPayload = normalizeInventoryQuantities(req.body);
  if (quantityPayload.error) return res.status(400).json({ error: quantityPayload.error });
  const stockQuantity = quantityPayload.quantity;
  const openedQuantity = quantityPayload.opened_quantity_remaining;
  try {
    await pool.query(
      'UPDATE shop_items SET name = ?, category = ?, unit = ?, reorder_level = ?, notes = ?, quantity = ?, opened_quantity_remaining = ?, is_folder = ?, parent_id = ?, classification = ?, unit_price = ? WHERE id = ?',
      [name, category, unit || 'pcs', reorder_level || 0, notes || null, stockQuantity, openedQuantity, is_folder ? 1 : 0, parent_id || null, classification || null, unit_price != null ? unit_price : null, req.params.id]
    );
    await pool.query(
      'INSERT INTO shop_transactions (item_id, action, quantity, unit, reason, transaction_date, action_by, staff_member_name) VALUES (?, "edited", ?, ?, "Stock balance updated", CURDATE(), ?, ?)',
      [req.params.id, stockQuantity, unit || 'pcs', req.user.id, resolveStaffMemberName(req)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/items/:id', async (req, res) => {
  try {
    const [children] = await pool.query('SELECT id FROM shop_items WHERE parent_id = ? AND is_active = 1 LIMIT 1', [req.params.id]);
    if (children.length) {
      return res.status(409).json({ error: 'Folder contains items. Move or remove them before deleting it.' });
    }
    await pool.query('UPDATE shop_items SET is_active = 0, deleted_by = ?, deleted_at = NOW() WHERE id = ?', [req.user.id, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/withdraw', async (req, res) => {
  const { item_id, quantity, reason, transaction_date } = req.body;
  const qty = parsePositiveQuantity(quantity);
  
  if (!item_id || qty == null) {
    return res.status(400).json({ error: 'Valid Item ID and quantity are required.' });
  }

  try {
    let tDate = null;
    if (transaction_date) {
      const selectedDate = new Date(transaction_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) return res.status(400).json({ error: 'Transaction date cannot be in the future.' });
      tDate = transaction_date;
    }

    const [items] = await pool.query('SELECT quantity, unit, opened_quantity_remaining FROM shop_items WHERE id = ? AND is_active = 1', [item_id]);
    if (!items.length) return res.status(404).json({ error: 'Item not found.' });
    const unitForTransaction = items[0].unit || 'pcs';
    if (parseFloat(items[0].quantity) < qty) return res.status(400).json({ error: 'Insufficient stock.' });

    await pool.query('UPDATE shop_items SET quantity = quantity - ?, opened_quantity_remaining = CASE WHEN opened_quantity_remaining IS NULL THEN NULL ELSE GREATEST(opened_quantity_remaining - ?, 0) END, last_withdrawn_at = NOW() WHERE id = ? AND quantity >= ?', [qty, qty, item_id, qty]);
    const [[{ remaining }]] = await pool.query('SELECT quantity as remaining FROM shop_items WHERE id = ?', [item_id]);
    if (remaining === undefined) return res.status(404).json({ error: 'Item not found.' });
    await pool.query(
      'INSERT INTO shop_transactions (item_id, action, quantity, unit, transaction_date, reason, action_by, staff_member_name) VALUES (?, "withdraw", ?, ?, COALESCE(?, CURDATE()), ?, ?, ?)',
      [item_id, qty, unitForTransaction, tDate, reason || null, req.user.id, resolveStaffMemberName(req)]
    );
    const [updated] = await pool.query('SELECT * FROM shop_items WHERE id = ?', [item_id]);
    res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error('[Shop Withdraw Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/restock', async (req, res) => {
  const { item_id, quantity, reason, transaction_date, unit_price_paid } = req.body;
  const qty = parsePositiveQuantity(quantity);
  
  if (!item_id || qty == null) {
    return res.status(400).json({ error: 'Valid Item ID and quantity are required.' });
  }

  try {
    if (transaction_date) {
      const selectedDate = new Date(transaction_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) return res.status(400).json({ error: 'Restock date cannot be in the future.' });
    }

    const [[stockItem]] = await pool.query('SELECT unit FROM shop_items WHERE id = ?', [item_id]);
    if (!stockItem) return res.status(404).json({ error: 'Item not found.' });
    const unitForTransaction = stockItem.unit || 'pcs';

    await pool.query(
      'UPDATE shop_items SET quantity = quantity + ?, last_restocked_at = NOW(), unit_price = COALESCE(?, unit_price) WHERE id = ?',
      [qty, unit_price_paid, item_id]
    );
    await pool.query(
      'INSERT INTO shop_transactions (item_id, action, quantity, unit, transaction_date, reason, action_by, unit_price_paid, staff_member_name) VALUES (?, "restock", ?, ?, COALESCE(?, CURDATE()), ?, ?, ?, ?)',
      [item_id, qty, unitForTransaction, transaction_date || null, reason || null, req.user.id, unit_price_paid != null ? unit_price_paid : null, resolveStaffMemberName(req)]
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
    SELECT t.*, i.name as item_name, i.category, COALESCE(NULLIF(u.display_name, ''), u.email) as action_by_name, COALESCE(NULLIF(t.staff_member_name, ''), NULLIF(u.display_name, ''), u.email) as staff_member_name
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
  sql += ' ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT 200';
  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
