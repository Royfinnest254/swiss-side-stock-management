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
