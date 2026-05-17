/**
 * Swiss Side Data Migration Script
 * Reads swiss_side_audit_export_20260426.csv and imports into the transactions table.
 * 
 * Usage: node scripts/migrate.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Look for CSV in the same folder as the script first
const LOCAL_CSV = path.join(__dirname, 'swiss_side_audit_export_20260426.csv');
const CSV_PATH = fs.existsSync(LOCAL_CSV) ? LOCAL_CSV : path.join(__dirname, '../../..', 'Downloads', 'swiss_side_audit_export_20260426.csv');

async function migrate() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('📂 Reading CSV from:', CSV_PATH);
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.trim().split('\n');

  // Remove header line
  const headers = lines.shift().split(',');
  console.log('Headers:', headers);

  let imported = 0;
  let skipped = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    // Handle commas inside quoted fields
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || line.split(',').map(c => c.trim());

    const [timestamp, itemName, action, quantity, unit, personnel, notes] = cols;

    if (!itemName || !action || !quantity) { skipped++; continue; }
    if (!['RESTOCK', 'WITHDRAWAL'].includes(action.toUpperCase())) { skipped++; continue; }

    try {
      await pool.query(
        `INSERT INTO transactions (item_name, type, quantity, unit, person, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          itemName.toUpperCase(),
          action.toUpperCase(),
          parseFloat(quantity) || 0,
          unit || 'units',
          personnel || 'imported',
          notes || null,
          timestamp ? new Date(timestamp) : new Date(),
        ]
      );
      imported++;
    } catch (err) {
      console.warn(`⚠️  Skipped row: ${line} — ${err.message}`);
      skipped++;
    }
  }

  console.log(`✅ Migration complete. Imported: ${imported}, Skipped: ${skipped}`);
  await pool.end();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
