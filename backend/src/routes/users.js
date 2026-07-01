const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAuth, requireAdmin, clearUserCache } = require('../middleware/auth');
const { sendInvitation } = require('../services/email');
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');

// HELPERS
const isValidPassword = (pwd) => {
  return pwd && pwd.length >= 8; // [AUDIT #24] Basic production requirement
};

router.use(requireAuth, requireAdmin);

// Rate limiter for invitations: max 10 per hour per IP/admin
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many invitations sent. Limit is 10 per hour.' },
  standardHeaders: true,
  legacyHeaders: false
});

// POST /invite — admin sends invitation email to new staff member
router.post('/invite', inviteLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const cleanedEmail = email.trim().toLowerCase();

    // Check if user already exists (ignore inactive pending invites so they can be re-invited/overwritten)
    const [existing] = await pool.query('SELECT id, is_active, password FROM users WHERE email = ?', [cleanedEmail]);
    if (existing.length > 0) {
      if (existing[0].is_active === 0 && existing[0].password === 'PENDING') {
        // Safe to remove the previous failed/uncompleted invite record first so we can recreate it
        await pool.query('DELETE FROM users WHERE id = ?', [existing[0].id]);
      } else {
        return res.status(400).json({ error: 'A user with this email already exists.' });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const appUrl = process.env.APP_URL || 'https://swiss-side.store';
    const inviteUrl = `${appUrl}/api/auth/accept-invite?token=${token}&email=${encodeURIComponent(cleanedEmail)}`;

    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(
      `INSERT INTO users (email, password, role, invite_token, invite_token_expiry, is_active, invited_at)
       VALUES (?, ?, 'staff', ?, ?, 0, NOW())`,
      [cleanedEmail, 'PENDING', token, expiry]
    );

    const invitedByName = req.user.display_name || req.user.email;
    try {
      await sendInvitation(cleanedEmail, inviteUrl, invitedByName);
    } catch (mailErr) {
      await pool.query('DELETE FROM users WHERE email = ? AND is_active = 0 AND password = "PENDING"', [cleanedEmail]);
      console.error('[SMTP Error Code]', mailErr.code);
      console.error('[SMTP Error Full]', mailErr);
      return res.status(500).json({ 
        error: `Failed to invite: ${mailErr.message}`,
        smtp_code: mailErr.code,
        smtp_response: mailErr.response,
        smtp_command: mailErr.command
      });
    }

    res.json({ success: true, message: `Invitation sent to ${cleanedEmail}` });
  } catch (err) {
    console.error('[Invite Error]', err);
    res.status(500).json({ error: `Failed to invite: ${err.message}` });
  }
});

// GET / — List all active users
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, email, role, display_name, 
              CASE WHEN password = 'PENDING' THEN 'PENDING' ELSE 'SET' END AS password, 
              is_active, created_at, profile_photo, job_title, phone 
       FROM users 
       WHERE (is_active = 1 OR (is_active = 0 AND password = "PENDING")) 
         AND deleted_at IS NULL 
       ORDER BY role ASC, email ASC`
    );
    res.json(rows.map(r => ({ ...r, role: r.role === 'admin' ? 'admin' : r.role })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST / — Create staff account
router.post('/', async (req, res) => {
  const { email, password, firstName, lastName, displayName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const fullName = firstName && lastName ? `${firstName.trim()} ${lastName.trim()}`.slice(0, 100) : (displayName || null);

  try {
    const hashed = bcrypt.hashSync(password.slice(0, 100), 10);
    await pool.query(
      'INSERT INTO users (email, password, role, display_name) VALUES (?, ?, "staff", ?)',
      [email, hashed, fullName]
    );

    // Log action
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, "CREATE_STAFF", "ADMIN", ?)',
      [req.user.id, `Created staff account for ${email}`]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /:id — Soft Delete
router.delete('/:id', async (req, res) => {
  const targetId = req.params.id;
  if (parseInt(targetId) === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself.' });

  try {
    const [targets] = await pool.query('SELECT * FROM users WHERE id = ?', [targetId]);
    const target = targets[0];
    if (!target) return res.status(404).json({ error: 'User not found.' });

    if (target.role === 'admin') {
      const [admins] = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = "admin" AND is_active = 1');
      if (admins[0].count <= 1) return res.status(400).json({ error: 'Cannot delete the last administrator.' });
    }

    // Soft delete only: set is_active = 0, deleted_at = NOW()
    await pool.query('UPDATE users SET is_active = 0, deleted_at = NOW() WHERE id = ?', [targetId]);

    // Log action
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, "REMOVE_USER", "ADMIN", ?)',
      [req.user.id, `Removed user account ${target.email}`]
    );

    clearUserCache(targetId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /:id — Edit user details (Admin only)
router.put('/:id', async (req, res) => {
  const targetId = req.params.id;
  const { email, display_name, phone, job_title, role } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const [targets] = await pool.query('SELECT * FROM users WHERE id = ?', [targetId]);
    const target = targets[0];
    if (!target) return res.status(404).json({ error: 'User not found.' });

    // Update details
    await pool.query(
      `UPDATE users 
       SET email = ?, display_name = ?, phone = ?, job_title = ?, role = ? 
       WHERE id = ?`,
      [email, display_name || null, phone || null, job_title || null, role || 'staff', targetId]
    );

    // Log action
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, "EDIT_USER", "ADMIN", ?)',
      [req.user.id, `Modified user account ${target.email}`]
    );

    clearUserCache(targetId);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /:id/promote — Promote staff user to admin role
router.patch('/:id/promote', async (req, res) => {
  const targetId = req.params.id;
  try {
    const [targets] = await pool.query('SELECT * FROM users WHERE id = ?', [targetId]);
    const target = targets[0];
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'admin') return res.status(400).json({ error: 'User is already an administrator.' });

    await pool.query('UPDATE users SET role = "admin" WHERE id = ?', [targetId]);

    // Log action in audit logs
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, "PROMOTE_ADMIN", "ADMIN", ?)',
      [req.user.id, `Promoted user account ${target.email} to Administrator`]
    );

    clearUserCache(targetId);
    res.json({ success: true, message: `Successfully promoted ${target.email} to Administrator.` });
  } catch (err) {
    console.error('[Promote Error]', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /admin-logs - with paginated database queries for massive speed optimization
router.get('/admin-logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    res.json(rows);
  } catch (err) {
    console.error('[Admin Logs Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /db-integrity — Run live database data quality scan
router.get('/db-integrity', async (req, res) => {
  const report = {
    passed: true,
    warnings: [],
    errors: [],
    checksRun: 0
  };

  function addError(table, itemId, itemName, message) {
    report.passed = false;
    report.errors.push({ table, itemId, itemName, message });
  }

  function addWarning(table, itemId, itemName, message) {
    report.warnings.push({ table, itemId, itemName, message });
  }

  try {
    // 1. Users Check
    report.checksRun++;
    const [users] = await pool.query('SELECT id, email, role, is_active FROM users');
    if (users.length === 0) {
      addError('users', null, 'N/A', 'No users found in database.');
    } else {
      const activeAdmins = users.filter(u => u.role === 'admin' && u.is_active === 1);
      if (activeAdmins.length === 0) {
        addError('users', null, 'N/A', 'No active administrator account exists!');
      }
    }

    // 2. Shop Inventory Mismatches
    report.checksRun++;
    const [shopItems] = await pool.query('SELECT * FROM shop_items');
    const validShopCategories = ['Office Supplies', 'Merchandise'];
    for (const item of shopItems) {
      const name = item.name;
      const cat = item.category;
      const notes = item.notes || '';
      if (name !== name.trim()) {
        addWarning('shop_items', item.id, name, `Item name has leading/trailing whitespaces: "${name}"`);
      }
      if (!validShopCategories.includes(cat)) {
        addError('shop_items', item.id, name, `Invalid category "${cat}". Must be "Office Supplies" or "Merchandise".`);
      }
      const legacyKeywords = ['shop supplies', 'shop merchandise', 'shop/bike supplies', 'merchendise'];
      const hasLegacyKeyword = legacyKeywords.some(kw => 
        cat.toLowerCase().includes(kw) || notes.toLowerCase().includes(kw)
      );
      if (hasLegacyKeyword && cat !== 'Office Supplies' && cat !== 'Merchandise') {
        addError('shop_items', item.id, name, `Legacy category/note values found: category="${cat}", notes="${notes}"`);
      }
      if (item.quantity < 0) {
        addError('shop_items', item.id, name, `Negative quantity: ${item.quantity}`);
      }
    }

    // 3. Kitchen Inventory Validation
    report.checksRun++;
    const [kitchenItems] = await pool.query('SELECT * FROM kitchen_items');
    const validKitchenCats = ['consumables', 'crockery', 'electronics'];
    const validConditions = ['good', 'fair', 'needs_attention', 'broken'];
    for (const item of kitchenItems) {
      const name = item.name;
      if (name !== name.trim()) {
        addWarning('kitchen_items', item.id, name, `Item name has leading/trailing whitespaces: "${name}"`);
      }
      if (!validKitchenCats.includes(item.category)) {
        addError('kitchen_items', item.id, name, `Invalid category "${item.category}". Allowed: ${validKitchenCats.join(', ')}`);
      }
      if (item.condition_status && !validConditions.includes(item.condition_status)) {
        addError('kitchen_items', item.id, name, `Invalid condition status "${item.condition_status}". Allowed: ${validConditions.join(', ')}`);
      }
      if (item.quantity < 0) {
        addError('kitchen_items', item.id, name, `Negative quantity: ${item.quantity}`);
      }
    }

    // 4. Spa Inventory Validation
    report.checksRun++;
    const [spaItems] = await pool.query('SELECT * FROM spa_items');
    const validSpaSections = ['equipment', 'products'];
    for (const item of spaItems) {
      const name = item.name;
      if (name !== name.trim()) {
        addWarning('spa_items', item.id, name, `Item name has leading/trailing whitespaces: "${name}"`);
      }
      if (!validSpaSections.includes(item.section)) {
        addError('spa_items', item.id, name, `Invalid section "${item.section}". Allowed: ${validSpaSections.join(', ')}`);
      }
      if (item.quantity < 0) {
        addError('spa_items', item.id, name, `Negative quantity: ${item.quantity}`);
      }
    }

    // 5. Laundry Inventory Validation
    report.checksRun++;
    const [laundryItems] = await pool.query('SELECT * FROM laundry_items');
    for (const item of laundryItems) {
      const name = item.name;
      if (name !== name.trim()) {
        addWarning('laundry_items', item.id, name, `Item name has leading/trailing whitespaces: "${name}"`);
      }
      if (item.quantity < 0) {
        addError('laundry_items', item.id, name, `Negative quantity: ${item.quantity}`);
      }
    }

    // 6. Gym Inventory Validation
    report.checksRun++;
    const [gymItems] = await pool.query('SELECT * FROM gym_inventory');
    for (const item of gymItems) {
      const name = item.name;
      if (name !== name.trim()) {
        addWarning('gym_inventory', item.id, name, `Item name has leading/trailing whitespaces: "${name}"`);
      }
      if (item.quantity < 0) {
        addError('gym_inventory', item.id, name, `Negative quantity: ${item.quantity}`);
      }
    }

    // 7. Duplicate Name Detection
    report.checksRun++;
    const tablesToCheck = ['kitchen_items', 'spa_items', 'shop_items', 'laundry_items', 'gym_inventory', 'supplies_items'];
    for (const table of tablesToCheck) {
      const [duplicates] = await pool.query(`
        SELECT name, COUNT(*) as count 
        FROM \`${table}\` 
        WHERE is_active = 1 
        GROUP BY name 
        HAVING count > 1
      `);
      if (duplicates.length > 0) {
        for (const dup of duplicates) {
          addWarning(table, null, dup.name, `Duplicate active items named "${dup.name}" detected (${dup.count} entries).`);
        }
      }
    }

    res.json(report);
  } catch (err) {
    console.error('[DB Integrity Test Error]', err);
    res.status(500).json({ error: 'Server error run integrity test.' });
  }
});

// GET /metrics — Get database health metrics
router.get('/metrics', async (req, res) => {
  try {
    const [
      [usersStats],
      [kitchenStats],
      [spaStats],
      [shopStats],
      [gymStats],
      [suppliesStats],
      [laundryStats],
      [accommodationStats],
      [needsStats]
    ] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) as users,
          COALESCE(SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END), 0) as admins,
          COALESCE(SUM(CASE WHEN role = 'staff' THEN 1 ELSE 0 END), 0) as staff
        FROM users WHERE is_active = 1 AND deleted_at IS NULL
      `),
      pool.query('SELECT COUNT(*) as count FROM kitchen_items WHERE is_active = 1'),
      pool.query('SELECT COUNT(*) as count FROM spa_items WHERE is_active = 1'),
      pool.query('SELECT COUNT(*) as count FROM shop_items WHERE is_active = 1'),
      pool.query('SELECT COUNT(*) as count FROM gym_inventory WHERE is_active = 1'),
      pool.query('SELECT COUNT(*) as count FROM supplies_items WHERE is_active = 1'),
      pool.query('SELECT COUNT(*) as count FROM laundry_items WHERE is_active = 1'),
      pool.query('SELECT COUNT(*) as count FROM accommodation_houses WHERE is_active = 1'),
      pool.query('SELECT COUNT(*) as count FROM needs WHERE is_active = 1')
    ]);

    res.json({
      users: usersStats[0].users,
      admins: usersStats[0].admins,
      staff: usersStats[0].staff,
      kitchen: kitchenStats[0].count,
      spa: spaStats[0].count,
      shop: shopStats[0].count,
      gym_prod: gymStats[0].count,
      supplies: suppliesStats[0].count,
      laundry: laundryStats[0].count,
      houses: accommodationStats[0].count,
      needs: needsStats[0].count
    });
  } catch (err) {
    console.error('[Users Metrics Error]', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
