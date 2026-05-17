const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const pool = require('../db');

// User cache with 30 second TTL
const userCache = new NodeCache({ stdTTL: 30, checkperiod: 10 });

const requireAuth = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Token missing.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.iss !== 'swiss-side') {
      return res.status(401).json({ error: 'Invalid token issuer.' });
    }
    const userId = decoded.id;

    // Check Cache
    let user = userCache.get(userId);
    if (!user) {
      // Cache miss - query DB
      const [rows] = await pool.query(
        'SELECT id, email, role, display_name, is_active FROM users WHERE id = ?',
        [userId]
      );
      user = rows[0];
      if (!user) return res.status(401).json({ error: 'User no longer exists.' });

      // Store in cache exactly as in DB
      userCache.set(userId, user);
    }

    // Token invalidation check for soft-deleted/deactivated users
    if (user.is_active === 0) {
      return res.status(401).json({ error: 'Your account has been deactivated.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
};

const requireStaff = (req, res, next) => {
  if (req.user.role !== 'staff' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Staff privileges required.' });
  }
  next();
};

const clearUserCache = (userId) => {
  userCache.del(userId);
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireStaff,
  clearUserCache
};
