const router = require('express').Router();
const pool = require('../db');
const { resolveStaffMemberName } = require('../utils/staffMember');
const { normalizeInventoryQuantities, parsePositiveQuantity } = require('../utils/inventoryQuantity');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/items', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM spa_items WHERE is_active = 1 ORDER BY section, name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/items', async (req, res) => {
  const { name, unit, reorder_level, notes, is_folder, parent_id, classification, unit_price } = req.body;
  const quantityPayload = normalizeInventoryQuantities(req.body);
  if (quantityPayload.error) return res.status(400).json({ error: quantityPayload.error });
  const stockQuantity = quantityPayload.quantity;
  const openedQuantity = quantityPayload.opened_quantity_remaining;
  const rawSection = req.body.section || req.body.category;
  if (!name || !rawSection) return res.status(400).json({ error: 'Name and section/category required.' });

  let normalizedSection = 'products';
  if (rawSection.toLowerCase().includes('equipment')) {
    normalizedSection = 'equipment';
  }

  try {
    let finalQty = stockQuantity || 0;
    let finalReorder = reorder_level || 0;
    let finalCondition = 'good';

    if (normalizedSection === 'products') {
      finalCondition = null;
    } else {
      finalQty = stockQuantity || 1;
      finalReorder = 0;
    }

    const [result] = await pool.query(
      'INSERT INTO spa_items (name, section, quantity, opened_quantity_remaining, unit, reorder_level, condition_status, notes, is_folder, parent_id, classification, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, normalizedSection, finalQty, openedQuantity, unit || null, finalReorder, finalCondition, notes || null, is_folder ? 1 : 0, parent_id || null, classification || null, unit_price != null ? unit_price : null]
    );

    await pool.query(
      'INSERT INTO spa_transactions (item_id, action, quantity, unit, transaction_date, action_by, staff_member_name) VALUES (?, "added", ?, ?, CURDATE(), ?, ?)',
      [result.insertId, finalQty, unit || 'pcs', req.user.id, resolveStaffMemberName(req)]
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/items/:id', async (req, res) => {
  const { name, unit, reorder_level, notes, is_folder, parent_id, classification, unit_price } = req.body;
  const quantityPayload = normalizeInventoryQuantities(req.body);
  if (quantityPayload.error) return res.status(400).json({ error: quantityPayload.error });
  const stockQuantity = quantityPayload.quantity;
  const openedQuantity = quantityPayload.opened_quantity_remaining;
  const rawSection = req.body.section || req.body.category;
  if (!rawSection) return res.status(400).json({ error: 'Section/category is required.' });

  let normalizedSection = 'products';
  if (rawSection.toLowerCase().includes('equipment')) {
    normalizedSection = 'equipment';
  }

  try {
    await pool.query(
      'UPDATE spa_items SET name = ?, section = ?, unit = ?, reorder_level = ?, notes = ?, quantity = ?, opened_quantity_remaining = ?, is_folder = ?, parent_id = ?, classification = ?, unit_price = ? WHERE id = ?',
      [name, normalizedSection, unit || null, reorder_level || 0, notes || null, stockQuantity, openedQuantity, is_folder ? 1 : 0, parent_id || null, classification || null, unit_price != null ? unit_price : null, req.params.id]
    );
    await pool.query(
      'INSERT INTO spa_transactions (item_id, action, quantity, unit, reason, transaction_date, action_by, staff_member_name) VALUES (?, "edited", ?, ?, "Stock balance updated", CURDATE(), ?, ?)',
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
    const [children] = await pool.query('SELECT id FROM spa_items WHERE parent_id = ? AND is_active = 1 LIMIT 1', [req.params.id]);
    if (children.length) {
      return res.status(409).json({ error: 'Folder contains items. Move or remove them before deleting it.' });
    }
    await pool.query(
      'UPDATE spa_items SET is_active = 0, deleted_by = ?, deleted_at = NOW() WHERE id = ?',
      [req.user.id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// FIX: Hardened Withdraw & Restock (Removed section="products" filter bug)
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

    const [items] = await pool.query('SELECT quantity, unit, opened_quantity_remaining FROM spa_items WHERE id = ? AND is_active = 1', [item_id]);
    if (!items.length) return res.status(404).json({ error: 'Item not found.' });
    const unitForTransaction = items[0].unit || 'pcs';
    
    if (parseFloat(items[0].quantity) < qty) {
      return res.status(400).json({ error: `Insufficient stock. Available: ${items[0].quantity}` });
    }

    await pool.query('UPDATE spa_items SET quantity = quantity - ?, opened_quantity_remaining = CASE WHEN opened_quantity_remaining IS NULL THEN NULL ELSE GREATEST(opened_quantity_remaining - ?, 0) END, last_withdrawn_at = NOW() WHERE id = ? AND quantity >= ?', [qty, qty, item_id, qty]);
    const [[{ remaining }]] = await pool.query('SELECT quantity as remaining FROM spa_items WHERE id = ?', [item_id]);
    if (remaining === undefined) return res.status(404).json({ error: 'Item not found.' });
    await pool.query(
      'INSERT INTO spa_transactions (item_id, action, quantity, unit, transaction_date, reason, action_by, staff_member_name) VALUES (?, "withdraw", ?, ?, COALESCE(?, CURDATE()), ?, ?, ?)',
      [item_id, qty, unitForTransaction, tDate, reason || null, req.user.id, resolveStaffMemberName(req)]
    );
    const [updated] = await pool.query('SELECT * FROM spa_items WHERE id = ?', [item_id]);
    res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error('[Spa Withdraw Error]', err.message);
    res.status(500).json({ error: 'Server error during withdrawal.' });
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

    const [[stockItem]] = await pool.query('SELECT unit FROM spa_items WHERE id = ?', [item_id]);
    if (!stockItem) return res.status(404).json({ error: 'Item not found.' });
    const unitForTransaction = stockItem.unit || 'pcs';

    await pool.query(
      'UPDATE spa_items SET quantity = quantity + ?, last_restocked_at = NOW(), unit_price = COALESCE(?, unit_price) WHERE id = ?',
      [qty, unit_price_paid, item_id]
    );
    await pool.query(
      'INSERT INTO spa_transactions (item_id, action, quantity, unit, transaction_date, reason, action_by, unit_price_paid, staff_member_name) VALUES (?, "restock", ?, ?, COALESCE(?, CURDATE()), ?, ?, ?, ?)',
      [item_id, qty, unitForTransaction, transaction_date || null, reason || null, req.user.id, unit_price_paid != null ? unit_price_paid : null, resolveStaffMemberName(req)]
    );
    const [updated] = await pool.query('SELECT * FROM spa_items WHERE id = ?', [item_id]);
    res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error('[Spa Restock Error]', err.message);
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
        'INSERT INTO spa_maintenance (item_id, description, transaction_date, logged_by) VALUES (?, ?, CURDATE(), ?)',
        [item_id, description, req.user.id]
      );
      await pool.query('UPDATE spa_items SET status = "repair_needed" WHERE id = ?', [item_id]);

      // Sync to global requests/needs table
      const [itemRows] = await pool.query('SELECT name FROM spa_items WHERE id = ?', [item_id]);
      const itemName = itemRows[0]?.name || 'Equipment';
      await pool.query(
        `INSERT INTO needs (request_type, item, department, notes, requestor, status, urgency, is_active, created_at)
         VALUES ('Maintenance', ?, 'Spa', ?, ?, 'pending', 'Medium', 1, NOW())`,
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
      SELECT m.*, i.name as item_name, i.section,
             u1.display_name as logged_by_name, u2.display_name as resolved_by_name
      FROM spa_maintenance m
      JOIN spa_items i ON m.item_id = i.id
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
    const [maint] = await pool.query('SELECT item_id FROM spa_maintenance WHERE id = ? AND status = "pending"', [req.params.id]);
    if (!maint.length) {
      return res.status(404).json({ error: 'Issue not found or already resolved.' });
    }

    await pool.query(
      `UPDATE spa_maintenance
       SET status = 'resolved', resolved_by = ?, resolved_at = ?, resolution_notes = ?, technician_name = ?
       WHERE id = ?`,
      [req.user.id, resolved_at || new Date(), resolution_notes || null, technician_name || null, req.params.id]
    );

    await pool.query('UPDATE spa_items SET status = "ok" WHERE id = ?', [maint[0].item_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH dismiss maintenance
router.patch('/maintenance/:id/dismiss', async (req, res) => {
  try {
    const [maint] = await pool.query('SELECT item_id FROM spa_maintenance WHERE id = ? AND status = "pending"', [req.params.id]);
    if (!maint.length) {
      return res.status(404).json({ error: 'Issue not found or already resolved.' });
    }

    await pool.query(
      `UPDATE spa_maintenance
       SET status = 'dismissed', resolved_by = ?, resolved_at = NOW()
       WHERE id = ?`,
      [req.user.id, req.params.id]
    );

    await pool.query('UPDATE spa_items SET status = "ok" WHERE id = ?', [maint[0].item_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});


router.get('/transactions', async (req, res) => {
  const { section, action, from_date, to_date, item_id } = req.query;
  let sql = `
    SELECT t.*, i.name as item_name, i.section, COALESCE(NULLIF(u.display_name, ''), u.email) as action_by_name, COALESCE(NULLIF(t.staff_member_name, ''), NULLIF(u.display_name, ''), u.email) as staff_member_name
    FROM spa_transactions t
    JOIN spa_items i ON t.item_id = i.id
    LEFT JOIN users u ON t.action_by = u.id
    WHERE 1=1
  `;
  const params = [];
  if (section) { sql += ' AND i.section = ?'; params.push(section); }
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
