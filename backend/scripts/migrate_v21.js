const pool = require('../src/db');

async function tableExists(table) {
  try {
    const [rows] = await pool.query('SHOW TABLES LIKE ?', [table]);
    return rows.length > 0;
  } catch (err) {
    console.error(`Error checking if table ${table} exists:`, err.message);
    return false;
  }
}

async function getExistingColumns(table) {
  try {
    const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
    return rows.map(r => r.Field.toLowerCase());
  } catch (err) {
    console.error(`Error getting columns for ${table}:`, err.message);
    return [];
  }
}

async function addColumnIfMissing(table, column, definition, afterColumn = null) {
  const existingCols = await getExistingColumns(table);
  if (existingCols.includes(column.toLowerCase())) {
    console.log(`  [SKIP] Column "${column}" already exists in table "${table}".`);
    return;
  }

  let sql = `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`;
  if (afterColumn) {
    sql += ` AFTER \`${afterColumn}\``;
  }

  try {
    await pool.query(sql);
    console.log(`  [OK] Added column "${column}" to table "${table}".`);
  } catch (err) {
    console.error(`  [ERROR] Failed to add column "${column}" to table "${table}":`, err.message);
  }
}

async function migrate() {
  console.log('Starting V21 Database Migrations...');

  // 1. Alter needs table to support all statuses
  if (await tableExists('needs')) {
    try {
      await pool.query(
        "ALTER TABLE `needs` MODIFY COLUMN `status` ENUM('pending', 'approved', 'ordered', 'fulfilled', 'dismissed') DEFAULT 'pending'"
      );
      console.log('  [OK] Modified status ENUM on table "needs".');
    } catch (err) {
      console.error('  [ERROR] Failed to modify status ENUM on "needs":', err.message);
    }

    // 2. Add missing columns to needs table
    await addColumnIfMissing('needs', 'request_type', 'VARCHAR(100) NULL', 'id');
    await addColumnIfMissing('needs', 'urgency', 'VARCHAR(100) NULL', 'notes');
    await addColumnIfMissing('needs', 'requestor_user_id', 'INT NULL', 'requestor');
    await addColumnIfMissing('needs', 'estimated_price', 'DECIMAL(10,2) NULL', 'quantity');
    await addColumnIfMissing('needs', 'currency', "VARCHAR(10) DEFAULT 'KSH'", 'estimated_price');
    await addColumnIfMissing('needs', 'approved_by', 'INT NULL', 'status');
    await addColumnIfMissing('needs', 'approved_at', 'DATETIME NULL', 'approved_by');
    await addColumnIfMissing('needs', 'is_active', 'TINYINT(1) DEFAULT 1', 'status');
  } else {
    console.log('  [WARNING] Table "needs" does not exist in the database.');
  }

  // 3. Add notes column to kitchen_items
  if (await tableExists('kitchen_items')) {
    await addColumnIfMissing('kitchen_items', 'notes', 'TEXT NULL');
  }

  // 4. Add notes column to spa_items
  if (await tableExists('spa_items')) {
    await addColumnIfMissing('spa_items', 'notes', 'TEXT NULL');
  }

  // 5. Add notes column to shop_items
  if (await tableExists('shop_items')) {
    await addColumnIfMissing('shop_items', 'notes', 'TEXT NULL');
  }

  // 6. Add category and notes column to supplies_items
  if (await tableExists('supplies_items')) {
    await addColumnIfMissing('supplies_items', 'category', "VARCHAR(100) DEFAULT 'Other'");
    await addColumnIfMissing('supplies_items', 'notes', 'TEXT NULL');
  }

  // 7. Add notes column to laundry_items
  if (await tableExists('laundry_items')) {
    await addColumnIfMissing('laundry_items', 'notes', 'TEXT NULL');
  }

  console.log('V21 Migrations complete.');
  process.exit(0);
}

migrate();
