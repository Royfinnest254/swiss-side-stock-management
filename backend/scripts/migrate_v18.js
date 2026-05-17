const pool = require('../src/db');

async function migrate() {
  console.log('🔄 Starting V18 Database Migrations...');
  
  const queries = [
    // 1. Alter needs table
    `ALTER TABLE \`needs\`
      ADD COLUMN \`request_type\`    VARCHAR(50)   NULL,
      ADD COLUMN \`urgency\`         VARCHAR(20)   DEFAULT 'Medium',
      ADD COLUMN \`estimated_price\` DECIMAL(10,2) NULL,
      ADD COLUMN \`currency\`        VARCHAR(10)   DEFAULT 'KSH',
      ADD COLUMN \`is_active\`       TINYINT(1)    DEFAULT 1,
      ADD COLUMN \`approved_by\`     INT           NULL,
      ADD COLUMN \`approved_at\`     DATETIME      NULL,
      MODIFY COLUMN \`status\` ENUM('pending','approved','ordered','fulfilled','dismissed') DEFAULT 'pending';`,

    // 2. Alter kitchen_maintenance table
    `ALTER TABLE \`kitchen_maintenance\`
      ADD COLUMN \`resolution_notes\` TEXT NULL;`,

    // 3. Alter spa_maintenance table
    `ALTER TABLE \`spa_maintenance\`
      ADD COLUMN \`resolution_notes\` TEXT NULL;`,

    // 4. Alter gym_maintenance table
    `ALTER TABLE \`gym_maintenance\`
      ADD COLUMN \`resolution_notes\` TEXT NULL;`,

    // 5. Alter shopping_list_items table
    `ALTER TABLE \`shopping_list_items\`
      ADD COLUMN \`list_id\`           INT           NULL,
      ADD COLUMN \`purchased\`         TINYINT(1)    DEFAULT 0,
      ADD COLUMN \`purchased_by\`      INT           NULL,
      ADD COLUMN \`purchased_at\`      DATETIME      NULL,
      ADD COLUMN \`actual_price_paid\` DECIMAL(10,2) NULL,
      ADD COLUMN \`notes\`             TEXT          NULL,
      ADD COLUMN \`total_cost\`        DECIMAL(10,2) NULL,
      ADD COLUMN \`module\`            VARCHAR(50)   NULL;`,

    // 6. Alter kitchen_items table
    `ALTER TABLE \`kitchen_items\`
      ADD COLUMN \`notes\`             TEXT     NULL,
      ADD COLUMN \`last_withdrawn_at\` DATETIME NULL,
      ADD COLUMN \`last_restocked_at\` DATETIME NULL;`,

    // 7. Alter shopping_lists table
    `ALTER TABLE \`shopping_lists\`
      ADD COLUMN \`completed_at\`      DATETIME NULL;`
  ];

  for (let i = 0; i < queries.length; i++) {
    try {
      console.log(`Executing step ${i + 1}/${queries.length}...`);
      await pool.query(queries[i]);
      console.log(`✅ Step ${i + 1} completed successfully.`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
        console.log(`  [SKIP] Step ${i + 1} — column already exists.`);
      } else {
        console.warn(`⚠️ Warning on step ${i + 1}:`, err.message);
      }
    }
  }

  console.log('🏁 V18 Database Migrations completed.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Critical migration error:', err);
  process.exit(1);
});
