const pool = require('./db');

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
    return;
  }

  let sql = `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`;
  if (afterColumn) {
    sql += ` AFTER \`${afterColumn}\``;
  }

  try {
    await pool.query(sql);
    console.log(`[AutoMigration] Added column "${column}" to table "${table}".`);
  } catch (err) {
    console.error(`[AutoMigration ERROR] Failed to add column "${column}" to table "${table}":`, err.message);
  }
}

async function runAutoMigrations() {
  console.log('[AutoMigration] Checking database schema health...');

  try {
    // 1. Align Users table
    if (await tableExists('users')) {
      await addColumnIfMissing('users', 'display_name', 'VARCHAR(100) DEFAULT NULL');
      await addColumnIfMissing('users', 'profile_photo', 'VARCHAR(255) DEFAULT NULL');
      await addColumnIfMissing('users', 'phone', 'VARCHAR(30) DEFAULT NULL');
      await addColumnIfMissing('users', 'job_title', 'VARCHAR(100) DEFAULT NULL');
      await addColumnIfMissing('users', 'reset_token', 'VARCHAR(128) DEFAULT NULL');
      await addColumnIfMissing('users', 'reset_token_expiry', 'DATETIME DEFAULT NULL');
      await addColumnIfMissing('users', 'invite_token', 'VARCHAR(255) DEFAULT NULL');
      await addColumnIfMissing('users', 'invite_token_expiry', 'DATETIME DEFAULT NULL');
      await addColumnIfMissing('users', 'is_active', 'TINYINT(1) DEFAULT 1');
      await addColumnIfMissing('users', 'invited_at', 'DATETIME DEFAULT NULL');
      await addColumnIfMissing('users', 'deleted_at', 'DATETIME DEFAULT NULL');
      await addColumnIfMissing('users', 'deleted_by', 'INT DEFAULT NULL');
      await addColumnIfMissing('users', 'failed_attempts', 'INT DEFAULT 0');
      await addColumnIfMissing('users', 'lock_until', 'BIGINT DEFAULT NULL');
    }

    // 2. Align Needs table
    if (await tableExists('needs')) {
      try {
        await pool.query(
          "ALTER TABLE `needs` MODIFY COLUMN `status` ENUM('pending', 'approved', 'ordered', 'fulfilled', 'dismissed') DEFAULT 'pending'"
        );
      } catch (err) {
        // Enums might fail if duplicate or values incompatible, but modify is safe to try
      }
      await addColumnIfMissing('needs', 'request_type', 'VARCHAR(100) NULL');
      await addColumnIfMissing('needs', 'urgency', 'VARCHAR(100) NULL');
      await addColumnIfMissing('needs', 'requestor_user_id', 'INT NULL');
      await addColumnIfMissing('needs', 'estimated_price', 'DECIMAL(10,2) NULL');
      await addColumnIfMissing('needs', 'currency', "VARCHAR(10) DEFAULT 'KSH'");
      await addColumnIfMissing('needs', 'approved_by', 'INT NULL');
      await addColumnIfMissing('needs', 'approved_at', 'DATETIME NULL');
      await addColumnIfMissing('needs', 'is_active', 'TINYINT(1) DEFAULT 1');
      await addColumnIfMissing('needs', 'deleted_at', 'DATETIME NULL');
    }

    // 3. Align other Inventory Tables
    if (await tableExists('kitchen_items')) {
      await addColumnIfMissing('kitchen_items', 'notes', 'TEXT NULL');
      await addColumnIfMissing('kitchen_items', 'status', "VARCHAR(50) DEFAULT 'ok'");
    }
    if (await tableExists('spa_items')) {
      await addColumnIfMissing('spa_items', 'notes', 'TEXT NULL');
      await addColumnIfMissing('spa_items', 'status', "VARCHAR(50) DEFAULT 'ok'");
    }
    if (await tableExists('shop_items')) {
      await addColumnIfMissing('shop_items', 'notes', 'TEXT NULL');
    }
    if (await tableExists('supplies_items')) {
      await addColumnIfMissing('supplies_items', 'category', "VARCHAR(100) DEFAULT 'Other'");
      await addColumnIfMissing('supplies_items', 'notes', 'TEXT NULL');
    }
    if (await tableExists('laundry_items')) {
      await addColumnIfMissing('laundry_items', 'notes', 'TEXT NULL');
      try {
        await pool.query(
          "ALTER TABLE `laundry_items` MODIFY COLUMN `category` VARCHAR(100) NOT NULL DEFAULT 'other'"
        );
        console.log('[AutoMigration] Converted laundry_items category to VARCHAR(100).');
      } catch (err) {
        console.error('[AutoMigration ERROR] Failed to modify laundry_items category:', err.message);
      }
    }

    // 3.5 Align Maintenance Tables (Kitchen, Spa, Gym, Room)
    const maintTables = ['kitchen_maintenance', 'gym_maintenance', 'spa_maintenance', 'room_maintenance'];
    for (const table of maintTables) {
      if (await tableExists(table)) {
        await addColumnIfMissing(table, 'resolution_notes', 'TEXT NULL');
        await addColumnIfMissing(table, 'technician_name', 'VARCHAR(150) DEFAULT NULL');
        await addColumnIfMissing(table, 'resolved_at', 'DATETIME DEFAULT NULL');
        await addColumnIfMissing(table, 'item_ids', 'JSON DEFAULT NULL');
      }
    }

    if (await tableExists('shop_transactions')) {
      try {
        await pool.query(
          "ALTER TABLE `shop_transactions` MODIFY COLUMN `action` ENUM('withdraw', 'restock', 'added', 'edited', 'condition_update') NOT NULL"
        );
        console.log('[AutoMigration] Aligned ENUM values for "shop_transactions".');
      } catch (err) {
        console.error('[AutoMigration ERROR] Failed to align ENUM for "shop_transactions":', err.message);
      }
    }

    // 4. Create and align shopping_lists table
    if (!(await tableExists('shopping_lists'))) {
      try {
        await pool.query(`
          CREATE TABLE \`shopping_lists\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`name\` VARCHAR(255) NOT NULL,
            \`status\` ENUM('Draft', 'Ordered', 'Completed', 'Archived') NOT NULL DEFAULT 'Draft',
            \`completed_at\` DATETIME DEFAULT NULL,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('[AutoMigration] Created table "shopping_lists".');
      } catch (err) {
        console.error('[AutoMigration ERROR] Failed to create table "shopping_lists":', err.message);
      }
    } else {
      await addColumnIfMissing('shopping_lists', 'completed_at', 'DATETIME DEFAULT NULL');
    }

    // 5. Create and align shopping_list_items table
    if (!(await tableExists('shopping_list_items'))) {
      try {
        await pool.query(`
          CREATE TABLE \`shopping_list_items\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`list_id\` INT DEFAULT NULL,
            \`name\` VARCHAR(255) NOT NULL,
            \`department\` VARCHAR(100) DEFAULT NULL,
            \`suggested_quantity\` DECIMAL(10,2) DEFAULT NULL,
            \`unit\` VARCHAR(50) DEFAULT NULL,
            \`price_per_unit\` DECIMAL(10,2) DEFAULT NULL,
            \`total_cost\` DECIMAL(10,2) DEFAULT NULL,
            \`is_manual\` TINYINT(1) DEFAULT 1,
            \`notes\` TEXT DEFAULT NULL,
            \`purchased\` TINYINT(1) DEFAULT 0,
            \`purchased_by\` INT DEFAULT NULL,
            \`purchased_at\` DATETIME DEFAULT NULL,
            \`actual_price_paid\` DECIMAL(10,2) DEFAULT NULL,
            \`module\` VARCHAR(50) DEFAULT NULL,
            \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (\`list_id\`) REFERENCES \`shopping_lists\`(\`id\`) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('[AutoMigration] Created table "shopping_list_items".');
      } catch (err) {
        console.error('[AutoMigration ERROR] Failed to create table "shopping_list_items":', err.message);
      }
    } else {
      await addColumnIfMissing('shopping_list_items', 'list_id', 'INT DEFAULT NULL');
      await addColumnIfMissing('shopping_list_items', 'department', 'VARCHAR(100) DEFAULT NULL');
      await addColumnIfMissing('shopping_list_items', 'suggested_quantity', 'DECIMAL(10,2) DEFAULT NULL');
      await addColumnIfMissing('shopping_list_items', 'price_per_unit', 'DECIMAL(10,2) DEFAULT NULL');
      await addColumnIfMissing('shopping_list_items', 'total_cost', 'DECIMAL(10,2) DEFAULT NULL');
      await addColumnIfMissing('shopping_list_items', 'is_manual', 'TINYINT(1) DEFAULT 1');
      await addColumnIfMissing('shopping_list_items', 'notes', 'TEXT DEFAULT NULL');
      await addColumnIfMissing('shopping_list_items', 'purchased', 'TINYINT(1) DEFAULT 0');
      await addColumnIfMissing('shopping_list_items', 'purchased_by', 'INT DEFAULT NULL');
      await addColumnIfMissing('shopping_list_items', 'purchased_at', 'DATETIME DEFAULT NULL');
      await addColumnIfMissing('shopping_list_items', 'actual_price_paid', 'DECIMAL(10,2) DEFAULT NULL');
      await addColumnIfMissing('shopping_list_items', 'module', 'VARCHAR(50) DEFAULT NULL');
    }

    console.log('[AutoMigration] Schema health alignment finished successfully.');
  } catch (err) {
    console.error('[AutoMigration FATAL ERROR]', err.message);
  }
}

module.exports = { runAutoMigrations };
