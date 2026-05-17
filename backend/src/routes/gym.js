const router = require('express').Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET all inventory items
router.get('/inventory', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM gym_inventory WHERE is_active = 1 ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST add new item — accepts name, quantity, unit, reorder_level, status, notes, is_folder, parent_id, classification
router.post('/inventory', async (req, res) => {
  const { name, quantity, unit, reorder_level, status, notes, is_folder, parent_id, classification } = req.body;
  if (!name) return res.status(400).json({ error: 'Item name required.' });
  try {
    const [result] = await pool.query(
      'INSERT INTO gym_inventory (name, quantity, unit, reorder_level, status, notes, is_folder, parent_id, classification) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, quantity || 0, unit || 'pcs', reorder_level || 0, status || 'ok', notes || null, is_folder ? 1 : 0, parent_id || null, classification || null]
    );
    if (quantity && quantity > 0) {
      await pool.query(
        'INSERT INTO gym_transactions (item_id, action, quantity, transaction_date, action_by) VALUES (?, "added", ?, CURDATE(), ?)',
        [result.insertId, quantity, req.user.id]
      );
    }
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT update item
router.put('/inventory/:id', async (req, res) => {
  const { name, quantity, unit, reorder_level, status, notes, is_folder, parent_id, classification } = req.body;
  try {
    await pool.query(
      'UPDATE gym_inventory SET name = ?, quantity = ?, unit = ?, reorder_level = ?, status = ?, notes = ?, is_folder = ?, parent_id = ?, classification = ? WHERE id = ?',
      [name, quantity || 0, unit || 'pcs', reorder_level || 0, status || 'ok', notes || null, is_folder ? 1 : 0, parent_id || null, classification || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE soft delete
router.delete('/inventory/:id', async (req, res) => {
  try {
    await pool.query(
      'UPDATE gym_inventory SET is_active = 0, deleted_by = ?, deleted_at = NOW() WHERE id = ?',
      [req.user.id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST restock or withdraw
router.post('/inventory/transaction', async (req, res) => {
  const { item_id, action, quantity, reason, transaction_date } = req.body;
  if (!item_id || !action || !quantity) return res.status(400).json({ error: 'item_id, action and quantity required.' });
  
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid quantity.' });

  try {
    let tDate = null;
    if (action === 'withdraw') {
      const [items] = await pool.query('SELECT quantity FROM gym_inventory WHERE id = ?', [item_id]);
      if (!items.length) return res.status(404).json({ error: 'Item not found.' });
      if (parseInt(items[0].quantity) < qty) {
        return res.status(400).json({ error: `Insufficient stock. Available: ${items[0].quantity}` });
      }
      await pool.query('UPDATE gym_inventory SET quantity = quantity - ? WHERE id = ? AND quantity >= ?', [qty, item_id, qty]);
    } else {
      if (transaction_date) {
        const selectedDate = new Date(transaction_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate > today) return res.status(400).json({ error: 'Restock date cannot be in the future.' });
        tDate = transaction_date;
      }
      await pool.query('UPDATE gym_inventory SET quantity = quantity + ? WHERE id = ?', [qty, item_id]);
    }

    await pool.query(
      'INSERT INTO gym_transactions (item_id, action, quantity, transaction_date, reason, action_by) VALUES (?, ?, ?, COALESCE(?, CURDATE()), ?, ?)',
      [item_id, action, qty, tDate, reason || null, req.user.id]
    );
    const [updated] = await pool.query('SELECT * FROM gym_inventory WHERE id = ?', [item_id]);
    res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error('[Gym Transaction Error]', err);
    res.status(500).json({ error: 'Server error.' });
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
        'INSERT INTO gym_maintenance (item_id, description, transaction_date, logged_by) VALUES (?, ?, CURDATE(), ?)',
        [item_id, description, req.user.id]
      );
      await pool.query('UPDATE gym_inventory SET status = "repair_needed" WHERE id = ?', [item_id]);

      // Sync to global requests/needs table
      const [itemRows] = await pool.query('SELECT name FROM gym_inventory WHERE id = ?', [item_id]);
      const itemName = itemRows[0]?.name || 'Equipment';
      await pool.query(
        `INSERT INTO needs (request_type, item, department, notes, requestor, status, urgency, is_active, created_at)
         VALUES ('Maintenance', ?, 'Gym', ?, ?, 'pending', 'Medium', 1, NOW())`,
        [itemName, description, req.user.display_name || req.user.email]
      );
    }
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET all maintenance
router.get('/maintenance', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.*, i.name as item_name, u1.display_name as logged_by_name, u2.display_name as resolved_by_name
      FROM gym_maintenance m
      JOIN gym_inventory i ON m.item_id = i.id
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

// PATCH resolve maintenance
router.patch('/maintenance/:id/resolve', async (req, res) => {
  const { resolution_notes, technician_name, resolved_at } = req.body;
  try {
    const [maint] = await pool.query('SELECT item_id FROM gym_maintenance WHERE id = ? AND status = "pending"', [req.params.id]);
    if (!maint.length) {
      return res.status(404).json({ error: 'Issue not found or already resolved.' });
    }

    await pool.query(
      `UPDATE gym_maintenance
       SET status = 'resolved', resolved_by = ?, resolved_at = ?, resolution_notes = ?, technician_name = ?
       WHERE id = ?`,
      [req.user.id, resolved_at || new Date(), resolution_notes || null, technician_name || null, req.params.id]
    );

    await pool.query('UPDATE gym_inventory SET status = "ok" WHERE id = ?', [maint[0].item_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET transactions history
router.get('/transactions', async (req, res) => {
  const { item_id, action, from_date, to_date } = req.query;
  let sql = `
    SELECT t.*, i.name as item_name, u.display_name as action_by_name
    FROM gym_transactions t
    JOIN gym_inventory i ON t.item_id = i.id
    LEFT JOIN users u ON t.action_by = u.id
    WHERE 1=1
  `;
  const params = [];
  if (item_id) { sql += ' AND t.item_id = ?'; params.push(item_id); }
  if (action) { sql += ' AND t.action = ?'; params.push(action); }
  if (from_date) { sql += ' AND t.transaction_date >= ?'; params.push(from_date); }
  if (to_date) { sql += ' AND t.transaction_date <= ?'; params.push(to_date); }
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
