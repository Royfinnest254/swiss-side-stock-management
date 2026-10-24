const router = require('express').Router();
const pool = require('../db');
const { normalizeInventoryQuantities, parsePositiveQuantity } = require('../utils/inventoryQuantity');
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
    const { name, unit, reorder_level, category, notes, is_folder, parent_id, classification, unit_price } = req.body;
    const quantityPayload = normalizeInventoryQuantities(req.body);
    if (quantityPayload.error) return res.status(400).json({ error: quantityPayload.error });
    const stockQuantity = quantityPayload.quantity;
    const openedQuantity = quantityPayload.opened_quantity_remaining;
    if (!name || !unit || !category) return res.status(400).json({ error: 'Name, unit, and category required.' });
    const [result] = await pool.query(
      'INSERT INTO general_supplies (name, quantity, opened_quantity_remaining, unit, reorder_level, category, notes, is_folder, parent_id, classification, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, stockQuantity, openedQuantity, unit, reorder_level || 0, category, notes || null, is_folder ? 1 : 0, parent_id || null, classification || null, unit_price != null ? unit_price : null]
    );
    if (stockQuantity > 0) {
      try {
        await pool.query(
          'INSERT INTO transactions (item_id, item_source, item_name, type, quantity, unit, person, notes) VALUES (?, "general_supplies", ?, "RESTOCK", ?, ?, ?, "Opening balance")',
          [result.insertId, name, stockQuantity, unit, req.user.display_name || req.user.email]
        );
      } catch (transactionError) {
        console.error('[General Supplies Opening Balance Log Error]', transactionError.message);
      }
    }
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/:id', requireStaff, async (req, res) => {
  try {
    const { name, unit, reorder_level, category, notes, is_folder, parent_id, classification, unit_price } = req.body;
    const quantityPayload = normalizeInventoryQuantities(req.body);
    if (quantityPayload.error) return res.status(400).json({ error: quantityPayload.error });
    const stockQuantity = quantityPayload.quantity;
    const openedQuantity = quantityPayload.opened_quantity_remaining;
    const [existingRows] = await pool.query('SELECT quantity, unit FROM general_supplies WHERE id = ? AND is_active = 1', [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ error: 'Item not found.' });
    const existingQuantity = Number(existingRows[0].quantity || 0);
    const existingUnit = existingRows[0].unit || unit;
    await pool.query(
      'UPDATE general_supplies SET name = ?, quantity = ?, opened_quantity_remaining = ?, unit = ?, reorder_level = ?, category = ?, notes = ?, is_folder = ?, parent_id = ?, classification = ?, unit_price = ? WHERE id = ?',
      [name, stockQuantity, openedQuantity, unit, reorder_level, category, notes || null, is_folder ? 1 : 0, parent_id || null, classification || null, unit_price != null ? unit_price : null, req.params.id]
    );
    try {
      if (existingUnit !== unit && existingQuantity > 0) {
        await pool.query(
          'INSERT INTO transactions (item_id, item_source, item_name, type, quantity, unit, person, notes) VALUES (?, "general_supplies", ?, "WITHDRAWAL", ?, ?, ?, "Unit changed; previous balance closed")',
          [req.params.id, name, existingQuantity, existingUnit, req.user.display_name || req.user.email]
        );
        if (stockQuantity > 0) {
          await pool.query(
            'INSERT INTO transactions (item_id, item_source, item_name, type, quantity, unit, person, notes) VALUES (?, "general_supplies", ?, "RESTOCK", ?, ?, ?, "Balance recounted in new unit")',
            [req.params.id, name, stockQuantity, unit, req.user.display_name || req.user.email]
          );
        }
      } else {
        const difference = stockQuantity - existingQuantity;
        if (difference !== 0) {
          await pool.query(
            'INSERT INTO transactions (item_id, item_source, item_name, type, quantity, unit, person, notes) VALUES (?, "general_supplies", ?, ?, ?, ?, ?, "Manual stock balance correction")',
            [req.params.id, name, difference > 0 ? 'RESTOCK' : 'WITHDRAWAL', Math.abs(difference), unit, req.user.display_name || req.user.email]
          );
        }
      }
    } catch (transactionError) {
      console.error('[General Supplies Balance Log Error]', transactionError.message);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [children] = await pool.query('SELECT id FROM general_supplies WHERE parent_id = ? AND is_active = 1 LIMIT 1', [req.params.id]);
    if (children.length) {
      return res.status(409).json({ error: 'Folder contains items. Move or remove them before deleting it.' });
    }
    await pool.query('UPDATE general_supplies SET is_active = 0, deleted_by = ?, deleted_at = NOW() WHERE id = ?', [req.user.id, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Feature 4, 5, 6: Transactional Endpoints
router.post('/withdraw', requireStaff, async (req, res) => {
  const { item_id, quantity, reason, transaction_date } = req.body;
  const qty = parsePositiveQuantity(quantity);
  if (!item_id || qty == null) return res.status(400).json({ error: 'Invalid ID/quantity.' });

  if (transaction_date) {
    const selectedDate = new Date(transaction_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate > today) return res.status(400).json({ error: 'Withdrawal date cannot be in the future.' });
  }

  try {
    const [items] = await pool.query('SELECT quantity FROM general_supplies WHERE id = ? AND is_active = 1', [item_id]);
    if (!items.length) return res.status(404).json({ error: 'Item not found.' });
    if (parseFloat(items[0].quantity) < qty) return res.status(400).json({ error: 'Insufficient stock.' });

    await pool.query('UPDATE general_supplies SET quantity = quantity - ?, opened_quantity_remaining = CASE WHEN opened_quantity_remaining IS NULL THEN NULL ELSE GREATEST(opened_quantity_remaining - ?, 0) END WHERE id = ? AND quantity >= ?', [qty, qty, item_id, qty]);
    const [[{ remaining }]] = await pool.query('SELECT quantity as remaining FROM general_supplies WHERE id = ?', [item_id]);
    if (remaining === undefined) return res.status(404).json({ error: 'Item not found.' });
    // Use generic transactions table if module-specific doesn't exist
    try {
      await pool.query(
        'INSERT INTO transactions (item_id, item_source, item_name, type, quantity, unit, person, notes, created_at) SELECT ?, "general_supplies", name, "WITHDRAWAL", ?, unit, ?, ?, COALESCE(?, NOW()) FROM general_supplies WHERE id = ?',
        [item_id, qty, req.user.display_name || req.user.email, reason || null, transaction_date || null, item_id]
      );
    } catch (txErr) { /* transactions table may not exist, skip silently */ }
    const [updated] = await pool.query('SELECT * FROM general_supplies WHERE id = ?', [item_id]);
    res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/restock', requireStaff, async (req, res) => {
  const { item_id, quantity, reason, transaction_date, unit_price_paid } = req.body;
  const qty = parsePositiveQuantity(quantity);
  if (!item_id || qty == null) return res.status(400).json({ error: 'Invalid ID/quantity.' });

  if (transaction_date) {
    const selectedDate = new Date(transaction_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate > today) return res.status(400).json({ error: 'Restock date cannot be in the future.' });
  }

  try {
    // If a new cost price is provided, also update the item's unit_price
    if (unit_price_paid != null) {
      await pool.query('UPDATE general_supplies SET quantity = quantity + ?, unit_price = ? WHERE id = ?', [qty, unit_price_paid, item_id]);
    } else {
      await pool.query('UPDATE general_supplies SET quantity = quantity + ? WHERE id = ?', [qty, item_id]);
    }
    try {
      await pool.query(
        'INSERT INTO transactions (item_id, item_source, item_name, type, quantity, unit, person, notes, created_at) SELECT ?, "general_supplies", name, "RESTOCK", ?, unit, ?, ?, COALESCE(?, NOW()) FROM general_supplies WHERE id = ?',
        [item_id, qty, req.user.display_name || req.user.email, reason || null, transaction_date || null, item_id]
      );
    } catch (txErr) { /* transactions table may not exist, skip silently */ }
    const [updated] = await pool.query('SELECT * FROM general_supplies WHERE id = ?', [item_id]);
    res.json({ success: true, item: updated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
