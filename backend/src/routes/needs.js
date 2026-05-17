const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireStaff, requireAdmin } = require('../middleware/auth');
const { sendStatusNotification } = require('../services/email');

router.use(requireAuth);

// Self-healing database check for technician accountability columns on the global 'needs' table
(async () => {
  try {
    const [columns] = await pool.query('SHOW COLUMNS FROM `needs`');
    const columnNames = columns.map(c => c.Field.toLowerCase());
    
    if (!columnNames.includes('technician_name')) {
      await pool.query('ALTER TABLE `needs` ADD COLUMN `technician_name` VARCHAR(150) DEFAULT NULL');
      console.log('Self-healed: Added technician_name column to needs table.');
    }
    if (!columnNames.includes('resolved_at')) {
      await pool.query('ALTER TABLE `needs` ADD COLUMN `resolved_at` DATETIME DEFAULT NULL');
      console.log('Self-healed: Added resolved_at column to needs table.');
    }
    if (!columnNames.includes('resolution_notes')) {
      await pool.query('ALTER TABLE `needs` ADD COLUMN `resolution_notes` TEXT DEFAULT NULL');
      console.log('Self-healed: Added resolution_notes column to needs table.');
    }
    if (!columnNames.includes('resolved_by')) {
      await pool.query('ALTER TABLE `needs` ADD COLUMN `resolved_by` INT DEFAULT NULL');
      console.log('Self-healed: Added resolved_by column to needs table.');
    }
  } catch (err) {
    console.error('Self-healing database migration for needs table failed:', err.message);
  }
})();

// GET /api/needs
router.get('/', async (req, res) => {
  const { department } = req.query;
  let sql = `
    SELECT n.*, 
           u1.display_name as logged_by_name, 
           u2.display_name as resolved_by_name 
    FROM needs n
    LEFT JOIN users u1 ON n.requestor_user_id = u1.id
    LEFT JOIN users u2 ON n.resolved_by = u2.id
    WHERE n.is_active = 1
  `;
  const params = [];
  if (department) { 
    sql += ' AND n.department = ?'; 
    params.push(department); 
  }
  sql += ' ORDER BY FIELD(n.status, "pending", "approved", "ordered", "fulfilled") ASC, n.created_at DESC';
  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/needs
router.post('/', async (req, res) => {
  const { request_type, item, department, quantity, estimated_price, notes, urgency, requestor } = req.body;
  
  const cleanItem = (item || '').trim().slice(0, 100);
  const cleanDept = (department || 'General').trim().slice(0, 100);
  const cleanNotes = (notes || '').trim().slice(0, 1000);
  const cleanRequestor = (requestor || req.user.display_name || req.user.email).trim().slice(0, 100);
  const cleanType = (request_type || 'Other').trim().slice(0, 50);
  const cleanUrgency = (urgency || 'Medium').trim().slice(0, 20);

  if (!cleanItem) {
    return res.status(400).json({ error: 'Item description is required.' });
  }

  try {
    await pool.query(
      `INSERT INTO needs (request_type, item, department, quantity, estimated_price, currency, notes, urgency, requestor, requestor_user_id, status, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 'KSH', ?, ?, ?, ?, 'pending', 1, NOW())`,
      [cleanType, cleanItem, cleanDept, quantity || null, estimated_price || null, cleanNotes || null, cleanUrgency, cleanRequestor, req.user.id]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/needs/:id/status
router.patch('/:id/status', async (req, res) => {
  const { status, admin_note } = req.body;
  const valid = ['pending', 'approved', 'ordered', 'fulfilled', 'dismissed'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  try {
    // Fetch the need AND try to find the requestor's email from users table
    const [needs] = await pool.query(
      `SELECT n.*,
              u.email  AS requestor_email,
              u.display_name AS requestor_display
       FROM needs n
       LEFT JOIN users u ON (u.display_name COLLATE utf8mb4_unicode_ci = n.requestor COLLATE utf8mb4_unicode_ci OR u.email COLLATE utf8mb4_unicode_ci = n.requestor COLLATE utf8mb4_unicode_ci)
         AND u.is_active = 1
       WHERE n.id = ? AND n.is_active = 1
       LIMIT 1`,
      [req.params.id]
    );
    if (!needs.length) return res.status(404).json({ error: 'Request not found.' });
    const need = needs[0];

    // Build update
    let sql = 'UPDATE needs SET status = ?';
    const params = [status];
    if (status === 'approved') {
      sql += ', approved_by = ?, approved_at = NOW()';
      params.push(req.user.id);
    } else if (status === 'fulfilled') {
      sql += ', resolved_by = ?, resolved_at = NOW()';
      params.push(req.user.id);
    }
    sql += ' WHERE id = ? AND is_active = 1';
    params.push(req.params.id);

    const [result] = await pool.query(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Request not found or already deleted.' });
    }

    // Send email notification — non-blocking, never fails the response
    const adminName = req.user.display_name || req.user.email;
    const recipientEmail = need.requestor_email;
    if (recipientEmail && recipientEmail.includes('@')) {
      sendStatusNotification(
        recipientEmail,
        need.requestor_display || need.requestor,
        need.item,
        status,
        adminName,
        admin_note || null
      ).catch(err => console.error('[Needs Notification Error]', err.message));
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/needs/:id/resolve (specific premium resolution endpoint)
router.patch('/:id/resolve', async (req, res) => {
  const { resolution_notes, technician_name, resolved_at } = req.body;
  try {
    const [needs] = await pool.query('SELECT id FROM needs WHERE id = ? AND is_active = 1', [req.params.id]);
    if (!needs.length) {
      return res.status(404).json({ error: 'Maintenance ticket not found.' });
    }

    await pool.query(
      `UPDATE needs
       SET status = 'fulfilled', 
           resolved_by = ?, 
           resolved_at = ?, 
           resolution_notes = ?, 
           technician_name = ?
       WHERE id = ?`,
      [req.user.id, resolved_at || new Date(), resolution_notes || null, technician_name || null, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[Needs Resolve Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/needs/:id (general legacy compatibility and flexible updates)
router.put('/:id', async (req, res) => {
  const { status, resolution_notes, technician_name, resolved_at } = req.body;
  try {
    const [needs] = await pool.query('SELECT id FROM needs WHERE id = ? AND is_active = 1', [req.params.id]);
    if (!needs.length) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    let sql = 'UPDATE needs SET status = COALESCE(?, status)';
    const params = [status];

    if (status === 'fulfilled' || status === 'resolved') {
      sql += ', resolved_by = ?, resolved_at = ?, resolution_notes = ?, technician_name = ?';
      params.push(req.user.id, resolved_at || new Date(), resolution_notes || null, technician_name || null);
    }

    sql += ' WHERE id = ?';
    params.push(req.params.id);

    await pool.query(sql, params);
    res.json({ success: true });
  } catch (err) {
    console.error('[Needs PUT Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/needs/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'UPDATE needs SET is_active = 0, deleted_by = ?, deleted_at = NOW() WHERE id = ?',
      [req.user.id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
