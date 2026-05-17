'use strict';

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db');
const { requireAuth, clearUserCache } = require('../middleware/auth');
const { sendMagicLink, sendWelcomeEmail, sendPasswordChangedEmail } = require('../services/email');
const { rateLimit } = require('express-rate-limit');

const avatarDir = path.join(__dirname, '../../public/uploads/avatars');
if (!require('fs').existsSync(avatarDir)) {
  require('fs').mkdirSync(avatarDir, { recursive: true });
}

// Multer config for profile photos
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/avatars'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `user-${req.user.id}-${Date.now()}${ext}`);
  }
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, or WebP images are accepted.'));
  }
});

const cleanEmail = (raw) => {
  const str = (raw || '').trim().toLowerCase();
  const match = str.match(/\[([^\]]+)\]\([^)]+\)/);
  return (match ? match[1] : str).replace(/[\[\]()]/g, '').trim();
};

const generateToken = () => crypto.randomBytes(32).toString('hex');

const getAppUrl = () => process.env.APP_URL || 'https://swiss-side.store';
const getResetUrl = (token, email) =>
  `${getAppUrl()}/api/auth/magic-reset?token=${token}&email=${encodeURIComponent(email)}`;

router.post('/initialize', async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id FROM users LIMIT 1');
    if (existing.length > 0) return res.status(400).json({ error: 'System already initialized.' });

    const { email, password, firstName, lastName } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields required.' });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.slice(0, 100);
    const hashed = bcrypt.hashSync(password.slice(0, 100), 10);

    await pool.query(
      'INSERT INTO users (email, password, role, display_name) VALUES (?, ?, ?, ?)',
      [cleanEmail(email), hashed, 'admin', fullName]
    );

    res.json({ success: true, message: 'System initialized. Please log in.' });
  } catch (err) {
    console.error('[Initialize Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/is-empty', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id FROM users LIMIT 1');
    res.json({ isEmpty: rows.length === 0 });
  } catch (err) {
    res.status(500).json({ error: 'Service unavailable.' });
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

    const [rows] = await pool.query(
      'SELECT id, email, password, role, display_name, failed_attempts, lock_until, is_active FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid credentials.' });

    if (user.is_active === 0) {
      return res.status(401).json({ error: 'Your account has been deactivated.' });
    }

    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      const mins = Math.ceil((new Date(user.lock_until) - new Date()) / 60000);
      return res.status(403).json({ error: `Account locked. Try again in ${mins} minute(s).` });
    }

    const valid = bcrypt.compareSync(password.slice(0, 100), user.password);
    if (!valid) {
      const attempts = (user.failed_attempts || 0) + 1;
      if (attempts >= 5) {
        await pool.query(
          'UPDATE users SET failed_attempts = ?, lock_until = ? WHERE id = ?',
          [attempts, Date.now() + 15 * 60 * 1000, user.id]
        );
      } else {
        await pool.query('UPDATE users SET failed_attempts = ? WHERE id = ?', [attempts, user.id]);
      }
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    await pool.query('UPDATE users SET failed_attempts = 0, lock_until = NULL WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, iss: 'swiss-side' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { email: user.email, role: user.role === 'admin' ? 'admin' : user.role, display_name: user.display_name }
    });
  } catch (err) {
    console.error('[Login Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many password reset requests. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/request-reset', resetLimiter, async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const [rows] = await pool.query(
      'SELECT id, role, email, last_reset_request FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];

    if (!user) {
      // Avoid account enumeration by returning a generic success message
      return res.json({ success: true, message: 'A password reset link has been sent to your email.' });
    }

    if (user.last_reset_request) {
      const secondsSinceLast = (Date.now() - new Date(user.last_reset_request).getTime()) / 1000;
      if (secondsSinceLast < 60) {
        return res.status(429).json({ error: 'Please wait 1 minute before requesting another link.' });
      }
    }

    const token = generateToken();
    const resetUrl = getResetUrl(token, email);

    const expiry = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(
      `UPDATE users 
       SET reset_token = ?, 
           reset_token_expiry = ?,
           last_reset_request = NOW()
       WHERE id = ?`,
      [token, expiry, user.id]
    );

    await sendMagicLink(user.email, resetUrl);

    res.json({ success: true, message: 'A password reset link has been sent to your email.' });
  } catch (err) {
    console.error('[Request Reset Error]', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

router.get('/magic-reset', async (req, res) => {
  try {
    const email = cleanEmail(req.query.email);
    const token = (req.query.token || '').trim();

    if (!email || !token) {
      return res.send(resetPageHtml('Invalid Link', 'This reset link is invalid. Please request a new one.', null, null, true));
    }

    const [rows] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND reset_token = ? AND reset_token_expiry > NOW()',
      [email, token]
    );

    if (rows.length === 0) {
      const [check] = await pool.query(
        'SELECT id, reset_token_expiry FROM users WHERE email = ?',
        [email]
      );
      if (!check[0] || !check[0].reset_token_expiry) {
        return res.send(resetPageHtml('Invalid Link', 'This reset link is invalid or has already been used. Please request a new one.', null, null, true));
      }
      return res.send(resetPageHtml('Link Expired', 'This reset link has expired. Please go back and request a new one.', null, null, true));
    }

    res.send(resetPageHtml('Reset Your Password', null, token, email, false));
  } catch (err) {
    console.error('[Magic Reset GET Error]', err.message);
    res.send(resetPageHtml('Error', 'Something went wrong. Please try again.', null, null, true));
  }
});

router.post('/magic-reset', async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const token = (req.body.token || '').trim();
    const newPassword = (req.body.newPassword || '').trim();
    const confirmPassword = (req.body.confirmPassword || '').trim();

    if (!email || !token || !newPassword || !confirmPassword) {
      return res.send(resetPageHtml('Missing Fields', 'All fields are required.', token, email, false));
    }

    if (newPassword !== confirmPassword) {
      return res.send(resetPageHtml('Mismatch', 'Passwords do not match.', token, email, false));
    }

    if (newPassword.length < 8) {
      return res.send(resetPageHtml('Password Too Short', 'Password must be at least 8 characters.', token, email, false));
    }

    const [rows] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND reset_token = ? AND reset_token_expiry > NOW()',
      [email, token]
    );

    if (rows.length === 0) {
      const [check] = await pool.query(
        'SELECT id, reset_token_expiry FROM users WHERE email = ?',
        [email]
      );
      if (!check[0] || !check[0].reset_token_expiry) {
        return res.send(resetPageHtml('Invalid Link', 'This link is invalid or has already been used.', null, null, true));
      }
      return res.send(resetPageHtml('Link Expired', 'This link has expired. Please request a new one.', null, null, true));
    }

    const userId = rows[0].id;

    const hashed = bcrypt.hashSync(newPassword.slice(0, 100), 10);
    await pool.query(
      `UPDATE users 
       SET password = ?, 
           reset_token = NULL, 
           reset_token_expiry = NULL, 
           last_reset_request = NULL,
           failed_attempts = 0, 
           lock_until = NULL 
       WHERE id = ?`,
      [hashed, userId]
    );

    // Send styled password changed confirmation email
    sendPasswordChangedEmail(email, email).catch(err => {
      console.error('[Mail Error] Failed to send password reset confirmation email:', err.message);
    });

    res.send(resetPageHtml('Password Updated', 'Your password has been updated successfully. You can now log in.', null, null, true));
  } catch (err) {
    console.error('[Magic Reset POST Error]', err.message);
    res.send(resetPageHtml('Error', 'Something went wrong. Please try again.', null, null, true));
  }
});

function resetPageHtml(title, message, token, email, hideForm) {
  const appUrl = process.env.APP_URL || 'https://swiss-side.store';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Swiss Side — ${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', sans-serif;
      background: #f4f1ee;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border: 1px solid #e0dbd6;
      border-radius: 20px;
      width: 100%;
      max-width: 440px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(26,26,26,0.06);
    }
    .header {
      background: #1a1a1a;
      padding: 32px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 4px solid #A0604E;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .dot {
      width: 10px;
      height: 10px;
      background: #A0604E;
      border-radius: 50%;
    }
    .brand-name {
      color: #fff;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    .brand-sub {
      color: #888;
      font-size: 14px;
      font-weight: 400;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-left: 4px;
    }
    .location {
      color: #666;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .body { padding: 44px 40px; }
    .label {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #A0604E;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 26px;
      font-weight: 900;
      color: #1a1a1a;
      letter-spacing: -0.03em;
      margin-bottom: 24px;
      line-height: 1.15;
    }
    .message {
      font-size: 14px;
      color: #555;
      line-height: 1.7;
      margin-bottom: 28px;
    }
    .field { margin-bottom: 20px; }
    .field label {
      display: block;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 8px;
      margin-left: 2px;
    }
    .field input {
      width: 100%;
      padding: 14px 18px;
      border: 1px solid #e0dbd6;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      color: #1a1a1a;
      background: #faf9f7;
      outline: none;
      transition: all 0.2s ease;
    }
    .field input:focus {
      border-color: #A0604E;
      background: #fff;
      box-shadow: 0 0 0 4px rgba(160, 96, 78, 0.1);
    }
    .btn {
      width: 100%;
      padding: 16px;
      background: #1a1a1a;
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      cursor: pointer;
      margin-top: 10px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(26,26,26,0.1);
    }
    .btn:hover {
      background: #A0604E;
      box-shadow: 0 4px 16px rgba(160, 96, 78, 0.25);
    }
    .back {
      display: block;
      text-align: center;
      margin-top: 24px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #aaa;
      text-decoration: none;
      transition: color 0.2s ease;
    }
    .back:hover { color: #A0604E; }
    .footer {
      background: #faf9f7;
      border-top: 1px solid #ede9e5;
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer span {
      font-size: 10px;
      font-weight: 600;
      color: #bbb;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">
        <div class="dot"></div>
        <span class="brand-name">Swiss Side</span>
        <span class="brand-sub">Management</span>
      </div>
      <span class="location">Iten, Kenya</span>
    </div>
    <div class="body">
      <p class="label">Account Security</p>
      <h1>${title}</h1>
      ${message ? `<p class="message">${message}</p>` : ''}
      ${!hideForm ? `
      <form method="POST" action="/api/auth/magic-reset">
        <input type="hidden" name="token" value="${token || ''}"/>
        <input type="hidden" name="email" value="${email || ''}"/>
        <div class="field">
          <label>New Password</label>
          <input type="password" name="newPassword" placeholder="At least 8 characters" required minlength="8" autocomplete="new-password"/>
        </div>
        <div class="field">
          <label>Confirm Password</label>
          <input type="password" name="confirmPassword" placeholder="Repeat your password" required minlength="8" autocomplete="new-password"/>
        </div>
        <button type="submit" class="btn">Update Password &rarr;</button>
      </form>
      ` : ''}
      <a href="${appUrl}" class="back">Return to Login</a>
    </div>
    <div class="footer">
      <span>Swiss Side Training Camp</span>
      <span>&copy; ${new Date().getFullYear()}</span>
    </div>
  </div>
  ${!hideForm ? `
  <script>
    document.querySelector('form').addEventListener('submit', function(e) {
      var p1 = document.querySelector('[name="newPassword"]').value;
      var p2 = document.querySelector('[name="confirmPassword"]').value;
      if (p1 !== p2) {
        e.preventDefault();
        alert('Passwords do not match. Please try again.');
      }
    });
  </script>
  ` : ''}
</body>
</html>`;
}

// GET /accept-invite — shows the account setup page
router.get('/accept-invite', async (req, res) => {
  try {
    const email = (req.query.email || '').trim().toLowerCase();
    const token = (req.query.token || '').trim();

    if (!email || !token) {
      return res.send(invitePageHtml('Invalid Link', 'This invitation link is invalid.', null, null, true));
    }

    const [rows] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND invite_token = ? AND invite_token_expiry > NOW() AND is_active = 0',
      [email, token]
    );

    if (rows.length === 0) {
      return res.send(invitePageHtml('Link Expired', 'This invitation has expired or already been used. Please ask your administrator to send a new invitation.', null, null, true));
    }

    res.send(invitePageHtml('Set Up Your Account', null, token, email, false));
  } catch (err) {
    console.error('[Accept Invite GET]', err.message);
    res.send(invitePageHtml('Error', 'Something went wrong. Please try again.', null, null, true));
  }
});

// POST /accept-invite — processes the account setup form
router.post('/accept-invite', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const token = (req.body.token || '').trim();
    const firstName = (req.body.firstName || '').trim();
    const lastName = (req.body.lastName || '').trim();
    const newPassword = (req.body.newPassword || '').trim();
    const confirmPassword = (req.body.confirmPassword || '').trim();

    if (!email || !token || !firstName || !lastName || !newPassword || !confirmPassword) {
      return res.send(invitePageHtml('Missing Fields', 'All fields are required.', token, email, false));
    }

    if (newPassword !== confirmPassword) {
      return res.send(invitePageHtml('Mismatch', 'Passwords do not match.', token, email, false));
    }

    if (newPassword.length < 8) {
      return res.send(invitePageHtml('Password Too Short', 'Password must be at least 8 characters.', token, email, false));
    }

    const [rows] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND invite_token = ? AND invite_token_expiry > NOW() AND is_active = 0',
      [email, token]
    );

    if (rows.length === 0) {
      return res.send(invitePageHtml('Link Expired', 'This invitation has expired or already been used.', null, null, true));
    }

    const fullName = `${firstName} ${lastName}`.slice(0, 100);
    const hashed = bcrypt.hashSync(newPassword.slice(0, 100), 10);

    await pool.query(
      `UPDATE users SET 
        password = ?, 
        display_name = ?,
        invite_token = NULL,
        invite_token_expiry = NULL,
        is_active = 1
       WHERE id = ?`,
      [hashed, fullName, rows[0].id]
    );

    // Send premium styled Welcome Email
    sendWelcomeEmail(email, fullName).catch(err => {
      console.error('[Mail Error] Failed to send welcome email:', err.message);
    });

    const appUrl = process.env.APP_URL || 'https://swiss-side.store';
    res.send(invitePageHtml('Account Created', `Welcome to Swiss Side, ${firstName}. Your account is ready. You can now log in with your email and password.`, null, null, true, appUrl));
  } catch (err) {
    console.error('[Accept Invite POST]', err.message);
    res.send(invitePageHtml('Error', 'Something went wrong. Please try again.', null, null, true));
  }
});

function invitePageHtml(title, message, token, email, hideForm, appUrl) {
  const loginUrl = appUrl || process.env.APP_URL || 'https://swiss-side.store';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Swiss Side — ${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', sans-serif;
      background: #f4f1ee;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border: 1px solid #e0dbd6;
      border-radius: 20px;
      width: 100%;
      max-width: 480px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(26,26,26,0.06);
    }
    .header {
      background: #1a1a1a;
      padding: 32px 40px;
      text-align: center;
      border-bottom: 4px solid #A0604E;
    }
    .header img {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      margin: 0 auto 16px;
      display: block;
      object-fit: contain;
      background: #fff;
      padding: 8px;
    }
    .brand-name {
      color: #fff;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    .brand-sub {
      color: #888;
      font-size: 14px;
      font-weight: 400;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-left: 6px;
    }
    .body { padding: 44px 40px; }
    .label {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #A0604E;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 26px;
      font-weight: 900;
      color: #1a1a1a;
      letter-spacing: -0.03em;
      margin-bottom: 20px;
      line-height: 1.15;
    }
    .message {
      font-size: 14px;
      color: #555;
      line-height: 1.7;
      margin-bottom: 28px;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .field { margin-bottom: 20px; }
    .field label {
      display: block;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 8px;
      margin-left: 2px;
    }
    .field input {
      width: 100%;
      padding: 14px 18px;
      border: 1px solid #e0dbd6;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      color: #1a1a1a;
      background: #faf9f7;
      outline: none;
      transition: all 0.2s ease;
    }
    .field input:focus {
      border-color: #A0604E;
      background: #fff;
      box-shadow: 0 0 0 4px rgba(160, 96, 78, 0.1);
    }
    .btn {
      width: 100%;
      padding: 16px;
      background: #1a1a1a;
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      cursor: pointer;
      margin-top: 10px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(26,26,26,0.1);
    }
    .btn:hover {
      background: #A0604E;
      box-shadow: 0 4px 16px rgba(160, 96, 78, 0.25);
    }
    .footer {
      background: #faf9f7;
      border-top: 1px solid #ede9e5;
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer span {
      font-size: 10px;
      font-weight: 600;
      color: #bbb;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <img src="https://swiss-side.store/logo.png" alt="Swiss Side"/>
      <span class="brand-name">Swiss Side</span>
      <span class="brand-sub">Management</span>
    </div>
    <div class="body">
      <p class="label">Staff Onboarding</p>
      <h1>${title}</h1>
      ${message ? `<p class="message">${message}</p>` : ''}
      ${!hideForm ? `
      <form method="POST" action="/api/auth/accept-invite">
        <input type="hidden" name="token" value="${token || ''}"/>
        <input type="hidden" name="email" value="${email || ''}"/>
        <div class="row">
          <div class="field">
            <label>First Name</label>
            <input type="text" name="firstName" placeholder="John" required autocomplete="given-name"/>
          </div>
          <div class="field">
            <label>Last Name</label>
            <input type="text" name="lastName" placeholder="Doe" required autocomplete="family-name"/>
          </div>
        </div>
        <div class="field">
          <label>New Password</label>
          <input type="password" name="newPassword" placeholder="At least 8 characters" required minlength="8" autocomplete="new-password"/>
        </div>
        <div class="field">
          <label>Confirm Password</label>
          <input type="password" name="confirmPassword" placeholder="Repeat your password" required minlength="8" autocomplete="new-password"/>
        </div>
        <button type="submit" class="btn">Create My Account &rarr;</button>
      </form>
      ` : `<a href="${loginUrl}" class="btn" style="display:block;text-align:center;text-decoration:none;padding:16px;">Return to Login</a>`}
    </div>
    <div class="footer">
      <span>Swiss Side Training Camp</span>
      <span>&copy; ${new Date().getFullYear()}</span>
    </div>
  </div>
  ${!hideForm ? `
  <script>
    document.querySelector('form').addEventListener('submit', function(e) {
      var p1 = document.querySelector('[name="newPassword"]').value;
      var p2 = document.querySelector('[name="confirmPassword"]').value;
      if (p1 !== p2) { e.preventDefault(); alert('Passwords do not match.'); }
    });
  </script>` : ''}
</body>
</html>`;
}

router.post('/request-password-change', requireAuth, async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await pool.query(
      'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
      [token, expiry, req.user.id]
    );
    const resetUrl = getResetUrl(token, req.user.email);
    await sendMagicLink(req.user.email, resetUrl);
    res.json({ success: true, message: 'Password reset link sent to your email.' });
  } catch (err) {
    console.error('[Request Password Change Error]', err.message);
    res.status(500).json({ error: 'Failed to send reset link.' });
  }
});

router.post('/logout', requireAuth, (req, res) => {
  clearUserCache(req.user.id);
  res.json({ success: true });
});


router.patch('/me', requireAuth, async (req, res) => {
  const displayName = (req.body.displayName || '').trim().slice(0, 100) || null;
  const phone = (req.body.phone || '').trim().slice(0, 30) || null;
  const jobTitle = (req.body.jobTitle || '').trim().slice(0, 100) || null;
  try {
    await pool.query(
      'UPDATE users SET display_name = ?, phone = ?, job_title = ? WHERE id = ?',
      [displayName, phone, jobTitle, req.user.id]
    );
    clearUserCache(req.user.id);
    res.json({ success: true, display_name: displayName, phone, job_title: jobTitle });
  } catch (err) {
    console.error('[Update Profile Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.patch('/display-name', requireAuth, async (req, res) => {
  const displayName = (req.body.displayName || '').trim().slice(0, 100);
  if (!displayName) {
    return res.status(400).json({ error: 'Display name is required.' });
  }
  try {
    await pool.query('UPDATE users SET display_name = ? WHERE id = ?', [displayName, req.user.id]);
    clearUserCache(req.user.id);
    res.json({ success: true, display_name: displayName });
  } catch (err) {
    console.error('[Update Display Name Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  try {
    const [rows] = await pool.query('SELECT password, email, display_name FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const valid = bcrypt.compareSync(currentPassword.slice(0, 100), user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid current password.' });
    }

    const hashed = bcrypt.hashSync(newPassword.slice(0, 100), 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    clearUserCache(req.user.id);

    // Send styled security email for password change
    sendPasswordChangedEmail(user.email, user.display_name || user.email).catch(err => {
      console.error('[Mail Error] Failed to send password change email:', err.message);
    });

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[Change Password Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});


router.post('/clear-demo-data', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  const tables = [
    'kitchen_items', 'kitchen_transactions', 'kitchen_maintenance',
    'spa_items', 'spa_transactions', 'spa_maintenance',
    'shop_items', 'shop_transactions',
    'gym_inventory', 'gym_transactions', 'gym_maintenance',
    'supplies_items', 'supplies_transactions',
    'laundry_items', 'laundry_transactions',
    'accommodation_properties', 'accommodation_houses', 'accommodation_house_items',
    'needs', 'shopping_lists', 'shopping_list_items'
  ];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of tables) {
      await conn.query(`TRUNCATE TABLE \`${t}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();
    res.json({ success: true, message: 'All demo data cleared successfully.' });
  } catch (err) {
    await conn.rollback();
    console.error('[Clear Demo Data Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    conn.release();
  }
});

// GET /api/auth/me — returns current user profile including photo
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, display_name, role, profile_photo, phone, job_title FROM users WHERE id = ? AND is_active = 1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Get Me Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/auth/me/photo — upload profile photo
router.post('/me/photo', requireAuth, uploadAvatar.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file received.' });

  const photoPath = `/uploads/avatars/${req.file.filename}`;

  try {
    // Delete old photo if exists
    const [existing] = await pool.query('SELECT profile_photo FROM users WHERE id = ?', [req.user.id]);
    const oldPhoto = existing[0]?.profile_photo;
    if (oldPhoto) {
      const oldFullPath = path.join(__dirname, '../../public', oldPhoto);
      fs.unlink(oldFullPath, () => {}); // Non-blocking, silent fail
    }

    await pool.query('UPDATE users SET profile_photo = ? WHERE id = ?', [photoPath, req.user.id]);
    clearUserCache(req.user.id);

    res.json({ success: true, profile_photo: photoPath });
  } catch (err) {
    console.error('[Photo Upload Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
