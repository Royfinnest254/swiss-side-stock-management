const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 2,     // 300 IQ: Lowered connection footprint from 4 to 2 for shared hosting limits
  maxIdle: 2,             // Ensure idle connections are kept minimal
  idleTimeout: 10000,     // 10s idle connection timeout to free up slots quickly
  queueLimit: 100,
  charset: 'utf8mb4',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 20000,
  timezone: 'Z'
});

// Test connection
pool.getConnection()
  .then(conn => {
    console.log('MySQL Connection Pool Initialized');
    conn.release();
  })
  .catch(err => {
    console.error('MySQL Connection Failed:', err.message);
  });

module.exports = pool;
