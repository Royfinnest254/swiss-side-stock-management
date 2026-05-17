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

async function addColumnIfMissing(table, column, definition) {
  const existingCols = await getExistingColumns(table);
  if (existingCols.includes(column.toLowerCase())) {
    console.log(`  [SKIP] Column "${column}" already exists in table "${table}".`);
    return;
  }

  const sql = `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`;
  try {
    await pool.query(sql);
    console.log(`  [OK] Added column "${column}" to table "${table}".`);
  } catch (err) {
    console.error(`  [ERROR] Failed to add column "${column}" to table "${table}":`, err.message);
  }
}

async function migrate() {
  console.log('Starting V34 Database Migrations (Item Folders & Bulk Maintenance)...');

  const modules = [
    { itemTable: 'gym_inventory', maintTable: 'gym_maintenance' },
    { itemTable: 'kitchen_items', maintTable: 'kitchen_maintenance' },
    { itemTable: 'spa_items', maintTable: 'spa_maintenance' },
    { itemTable: 'shop_items', maintTable: null },
    { itemTable: 'supplies_items', maintTable: null },
    { itemTable: 'general_supplies', maintTable: null },
    { itemTable: 'laundry_items', maintTable: null },
    { itemTable: 'room_items', maintTable: 'room_maintenance' },
    { itemTable: 'accommodation_room_items', maintTable: null }
  ];

  for (const mod of modules) {
    // 1. Add Folder fields to Inventory tables
    if (await tableExists(mod.itemTable)) {
      console.log(`\nUpdating Item Table: ${mod.itemTable}`);
      await addColumnIfMissing(mod.itemTable, 'parent_id', 'INT NULL');
      await addColumnIfMissing(mod.itemTable, 'is_folder', 'TINYINT(1) DEFAULT 0');
      await addColumnIfMissing(mod.itemTable, 'classification', 'VARCHAR(100) NULL');
    }

    // 2. Add Bulk Maintenance fields to Maintenance tables
    if (mod.maintTable && await tableExists(mod.maintTable)) {
      console.log(`\nUpdating Maintenance Table: ${mod.maintTable}`);
      await addColumnIfMissing(mod.maintTable, 'item_ids', 'JSON NULL');
      await addColumnIfMissing(mod.maintTable, 'technician_name', 'VARCHAR(150) NULL');
      await addColumnIfMissing(mod.maintTable, 'resolved_at', 'DATETIME NULL');
    }
  }

  console.log('\nV34 Migrations complete.');
  process.exit(0);
}

migrate();
