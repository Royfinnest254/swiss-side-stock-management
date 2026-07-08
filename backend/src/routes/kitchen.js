const router = require('express').Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/items', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM kitchen_items WHERE is_active = 1 ORDER BY category, name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/items', async (req, res) => {
  const { name, category, quantity, unit, reorder_level, notes, is_folder, parent_id, classification } = req.body;
  const normalizedCategory = (category || 'consumables').toLowerCase();
  try {
    const [result] = await pool.query(
      'INSERT INTO kitchen_items (name, category, quantity, unit, reorder_level, notes, is_folder, parent_id, classification) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, normalizedCategory, quantity || 0, unit || 'pcs', reorder_level || 0, notes || null, is_folder ? 1 : 0, parent_id || null, classification || null]
    );
    await pool.query(
      'INSERT INTO kitchen_transactions (item_id, action, quantity, transaction_date, action_by) VALUES (?, "added", ?, CURDATE(), ?)',
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
  const normalizedCategory = (category || 'consumables').toLowerCase();
  try {
    await pool.query(
      'UPDATE kitchen_items SET name = ?, category = ?, unit = ?, reorder_level = ?, notes = ?, quantity = ?, is_folder = ?, parent_id = ?, classification = ? WHERE id = ?',
      [name, normalizedCategory, unit || 'pcs', reorder_level || 0, notes || null, quantity || 0, is_folder ? 1 : 0, parent_id || null, classification || null, req.params.id]
    );
    await pool.query(
      'INSERT INTO kitchen_transactions (item_id, action, quantity, transaction_date, action_by) VALUES (?, "edited", ?, CURDATE(), ?)',
      [req.params.id, quantity || 0, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/items/:id', async (req, res) => {
  try {
    await pool.query('UPDATE kitchen_items SET is_active = 0, deleted_by = ?, deleted_at = NOW() WHERE id = ?', [req.user.id, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// FIX: Hardened Withdraw
router.post('/withdraw', async (req, res) => {
  const { item_id, quantity, reason, transaction_date } = req.body;
  const qty = parseFloat(quantity);
  
  if (!item_id || isNaN(qty) || qty <= 0) {
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

    const [items] = await pool.query('SELECT quantity FROM kitchen_items WHERE id = ? AND is_active = 1', [item_id]);
    if (!items.length) return res.status(404).json({ error: 'Item not found.' });
    
    if (parseFloat(items[0].quantity) < qty) {
      return res.status(400).json({ error: `Insufficient stock. Available: ${items[0].quantity}` });
    }

    await pool.query('UPDATE kitchen_items SET quantity = quantity - ?, last_withdrawn_at = NOW() WHERE id = ? AND quantity >= ?', [qty, item_id, qty]);
    const [[{ remaining }]] = await pool.query('SELECT quantity as remaining FROM kitchen_items WHERE id = ?', [item_id]);
    if (remaining === undefined) return res.status(404).json({ error: 'Item not found.' });
    await pool.query(
      'INSERT INTO kitchen_transactions (item_id, action, quantity, transaction_date, reason, action_by) VALUES (?, "withdraw", ?, COALESCE(?, CURDATE()), ?, ?)',
      [item_id, qty, tDate, reason || null, req.user.id]
    );
    const [updated] = await pool.query('SELECT * FROM kitchen_items WHERE id = ?', [item_id]);
    res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error('[Kitchen Withdraw Error]', err.message);
    res.status(500).json({ error: 'Server error during withdrawal.' });
  }
});

router.post('/restock', async (req, res) => {
  const { item_id, quantity, reason, transaction_date } = req.body;
  const qty = parseFloat(quantity);

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

    await pool.query('UPDATE kitchen_items SET quantity = quantity + ?, last_restocked_at = NOW() WHERE id = ?', [qty, item_id]);
    await pool.query(
      'INSERT INTO kitchen_transactions (item_id, action, quantity, transaction_date, reason, action_by) VALUES (?, "restock", ?, COALESCE(?, CURDATE()), ?, ?)',
      [item_id, qty, transaction_date || null, reason || null, req.user.id]
    );
    const [updated] = await pool.query('SELECT * FROM kitchen_items WHERE id = ?', [item_id]);
    res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error('[Kitchen Restock Error]', err.message);
    res.status(500).json({ error: 'Server error during restock.' });
  }
});

// POST log maintenance (bulk selection)
router.post('/maintenance', async (req, res) => {
  const { item_ids, description } = req.body;
  if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0 || !description) {
    return res.status(400).json({ error: 'item_ids array and description required.' });
  }
  try {
    for (const item_id of item_ids) {
      await pool.query(
        'INSERT INTO kitchen_maintenance (item_id, description, transaction_date, logged_by) VALUES (?, ?, CURDATE(), ?)',
        [item_id, description, req.user.id]
      );
      await pool.query('UPDATE kitchen_items SET status = "repair_needed" WHERE id = ?', [item_id]);

      // Sync to global requests/needs table
      const [itemRows] = await pool.query('SELECT name FROM kitchen_items WHERE id = ?', [item_id]);
      const itemName = itemRows[0]?.name || 'Equipment';
      await pool.query(
        `INSERT INTO needs (request_type, item, department, notes, requestor, status, urgency, is_active, created_at)
         VALUES ('Maintenance', ?, 'Kitchen', ?, ?, 'pending', 'Medium', 1, NOW())`,
        [itemName, description, req.user.display_name || req.user.email]
      );
    }
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/maintenance', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.*, i.name as item_name, u1.display_name as logged_by_name, u2.display_name as resolved_by_name
      FROM kitchen_maintenance m
      JOIN kitchen_items i ON m.item_id = i.id
      LEFT JOIN users u1 ON m.logged_by = u1.id
      LEFT JOIN users u2 ON m.resolved_by = u2.id
      ORDER BY m.status ASC, m.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.patch('/maintenance/:id/resolve', async (req, res) => {
  const { resolution_notes, technician_name, resolved_at } = req.body;
  try {
    const [maint] = await pool.query('SELECT item_id FROM kitchen_maintenance WHERE id = ? AND status = "pending"', [req.params.id]);
    if (!maint.length) {
      return res.status(404).json({ error: 'Issue not found or already resolved.' });
    }

    await pool.query(
      `UPDATE kitchen_maintenance
       SET status = 'resolved', resolved_by = ?, resolved_at = ?, resolution_notes = ?, technician_name = ?
       WHERE id = ?`,
      [req.user.id, resolved_at || new Date(), resolution_notes || null, technician_name || null, req.params.id]
    );

    await pool.query('UPDATE kitchen_items SET status = "ok" WHERE id = ?', [maint[0].item_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH dismiss maintenance
router.patch('/maintenance/:id/dismiss', async (req, res) => {
  try {
    const [maint] = await pool.query('SELECT item_id FROM kitchen_maintenance WHERE id = ? AND status = "pending"', [req.params.id]);
    if (!maint.length) {
      return res.status(404).json({ error: 'Issue not found or already resolved.' });
    }

    await pool.query(
      `UPDATE kitchen_maintenance
       SET status = 'dismissed', resolved_by = ?, resolved_at = NOW()
       WHERE id = ?`,
      [req.user.id, req.params.id]
    );

    await pool.query('UPDATE kitchen_items SET status = "ok" WHERE id = ?', [maint[0].item_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});


router.get('/transactions', async (req, res) => {
  const { category, action, from_date, to_date, item_id } = req.query;
  let sql = `
    SELECT t.*, i.name as item_name, i.category, u.display_name as action_by_name
    FROM kitchen_transactions t
    JOIN kitchen_items i ON t.item_id = i.id
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
