const pool = require('../src/db');

async function migrate() {
  console.log('Starting V20 Database Migrations...');

  const queries = [
    // 1. Kitchen items — category classification
    `ALTER TABLE \`kitchen_items\`
      ADD COLUMN \`category\` VARCHAR(50) DEFAULT 'Consumables'`,

    // 2. Spa items — category classification
    `ALTER TABLE \`spa_items\`
      ADD COLUMN \`category\` VARCHAR(50) DEFAULT 'Product'`,

    // 3. Shop items — category classification
    `ALTER TABLE \`shop_items\`
      ADD COLUMN \`category\` VARCHAR(50) DEFAULT 'Merchandise'`,

    // 4. Laundry items — category classification
    `ALTER TABLE \`laundry_items\`
      ADD COLUMN \`category\` VARCHAR(50) DEFAULT 'Products & Supplies'`,

    // 5. Needs — record which user submitted the request (for email notification on approval)
    `ALTER TABLE \`needs\`
      ADD COLUMN \`requestor_user_id\` INT NULL`,

    // 6. Users — profile photo path
    `ALTER TABLE \`users\`
      ADD COLUMN \`profile_photo\` VARCHAR(255) NULL`,

    // 7. Users — Modify reset_token size to VARCHAR(64)
    `ALTER TABLE \`users\` MODIFY COLUMN \`reset_token\` VARCHAR(64) NULL`,

    // 8. Users — Modify reset_token_expiry to DATETIME
    `ALTER TABLE \`users\` MODIFY COLUMN \`reset_token_expiry\` DATETIME NULL`,

    // 9. Users — Modify role enum to support 'admin' and 'staff'
    `ALTER TABLE \`users\` MODIFY COLUMN \`role\` ENUM('admin','staff') NOT NULL DEFAULT 'staff'`,

    // 10. Users — Add missing invitation and soft-delete columns
    `ALTER TABLE \`users\` ADD COLUMN \`invite_token\` VARCHAR(255) NULL`,
    `ALTER TABLE \`users\` ADD COLUMN \`invite_token_expiry\` DATETIME NULL`,
    `ALTER TABLE \`users\` ADD COLUMN \`is_active\` TINYINT(1) DEFAULT 1`,
    `ALTER TABLE \`users\` ADD COLUMN \`invited_at\` DATETIME NULL`,
    `ALTER TABLE \`users\` ADD COLUMN \`deleted_at\` DATETIME NULL`,
    `ALTER TABLE \`users\` ADD COLUMN \`deleted_by\` INT NULL`
  ];

  for (let i = 0; i < queries.length; i++) {
    try {
      await pool.query(queries[i]);
      console.log(`  [OK] Query ${i + 1} of ${queries.length} executed.`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
        console.log(`  [SKIP] Query ${i + 1} — column already exists.`);
      } else {
        console.error(`  [ERROR] Query ${i + 1} failed:`, err.message);
      }
    }
  }

  console.log('V20 Migrations complete.');
  process.exit(0);
}

migrate();
