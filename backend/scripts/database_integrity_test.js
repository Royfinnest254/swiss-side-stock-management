const mysql = require('mysql2/promise');
require('dotenv').config();

async function runTest() {
  console.log('============================================================');
  console.log('SWISS SIDE DATABASE INTEGRITY & DATA QUALITY TESTING UTILITY');
  console.log('============================================================');
  console.log(`Connecting to DB: ${process.env.DB_NAME} at ${process.env.DB_HOST}...\n`);

  let pool;
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 10000
    });

    // Verify connection works
    const conn = await pool.getConnection();
    conn.release();
    console.log('✓ Database connection established successfully.');
  } catch (err) {
    console.error('✗ Database Connection Failed:', err.message);
    console.log('\n[Tip] Make sure this script runs on the Namecheap server or that your local .env is configured with correct credentials.');
    process.exit(1);
  }

  const report = {
    passed: true,
    warnings: [],
    errors: [],
    checksRun: 0
  };

  function addError(table, itemId, itemName, message) {
    report.passed = false;
    report.errors.push({ table, itemId, itemName, message });
  }

  function addWarning(table, itemId, itemName, message) {
    report.warnings.push({ table, itemId, itemName, message });
  }

  try {
    // ------------------------------------------------------------
    // Test 1: Validate User Accounts
    // ------------------------------------------------------------
    report.checksRun++;
    console.log('\n[1/7] Testing User accounts...');
    const [users] = await pool.query('SELECT id, email, role, is_active FROM users');
    if (users.length === 0) {
      addError('users', null, 'N/A', 'No users found in database.');
    } else {
      const activeAdmins = users.filter(u => u.role === 'admin' && u.is_active === 1);
      console.log(`  - Found ${users.length} total user accounts.`);
      console.log(`  - Found ${activeAdmins.length} active administrators.`);
      if (activeAdmins.length === 0) {
        addError('users', null, 'N/A', 'No active administrator account exists!');
      }
    }

    // ------------------------------------------------------------
    // Test 2: Shop Inventory Mismatches
    // ------------------------------------------------------------
    report.checksRun++;
    console.log('\n[2/7] Testing Shop Inventory Alignment...');
    const [shopItems] = await pool.query('SELECT * FROM shop_items');
    console.log(`  - Scanned ${shopItems.length} items.`);

    // Allowed shop categories
    const validShopCategories = ['Office Supplies', 'Merchandise'];

    for (const item of shopItems) {
      const name = item.name;
      const cat = item.category;
      const notes = item.notes || '';

      // Check for leading/trailing spaces
      if (name !== name.trim()) {
        addWarning('shop_items', item.id, name, `Item name has leading/trailing whitespaces: "${name}"`);
      }

      // Check category name matches allowed
      if (!validShopCategories.includes(cat)) {
        addError('shop_items', item.id, name, `Invalid category "${cat}". Must be "Office Supplies" or "Merchandise".`);
      }

      // Check for legacy categorization strings in category or notes
      const legacyKeywords = ['shop supplies', 'shop merchandise', 'shop/bike supplies', 'merchendise'];
      const hasLegacyKeyword = legacyKeywords.some(kw => 
        cat.toLowerCase().includes(kw) || notes.toLowerCase().includes(kw)
      );

      // Exempt acceptable values like 'Office Supplies' or 'Merchandise'
      if (hasLegacyKeyword && cat !== 'Office Supplies' && cat !== 'Merchandise') {
        addError('shop_items', item.id, name, `Legacy category/note values found: category="${cat}", notes="${notes}"`);
      }

      // Quantity validations
      if (item.quantity < 0) {
        addError('shop_items', item.id, name, `Negative quantity found: ${item.quantity}`);
      }
      if (item.reorder_level < 0) {
        addError('shop_items', item.id, name, `Negative reorder level: ${item.reorder_level}`);
      }
    }

    // ------------------------------------------------------------
    // Test 3: Kitchen Inventory Validation
    // ------------------------------------------------------------
    report.checksRun++;
    console.log('\n[3/7] Testing Kitchen Inventory...');
    const [kitchenItems] = await pool.query('SELECT * FROM kitchen_items');
    console.log(`  - Scanned ${kitchenItems.length} items.`);
    
    const validKitchenCats = ['consumables', 'crockery', 'electronics'];
    const validConditions = ['good', 'fair', 'needs_attention', 'broken'];

    for (const item of kitchenItems) {
      const name = item.name;
      if (name !== name.trim()) {
        addWarning('kitchen_items', item.id, name, `Item name has leading/trailing whitespaces: "${name}"`);
      }
      if (!validKitchenCats.includes(item.category)) {
        addError('kitchen_items', item.id, name, `Invalid category "${item.category}". Allowed: ${validKitchenCats.join(', ')}`);
      }
      if (item.condition_status && !validConditions.includes(item.condition_status)) {
        addError('kitchen_items', item.id, name, `Invalid condition status "${item.condition_status}". Allowed: ${validConditions.join(', ')}`);
      }
      if (item.quantity < 0) {
        addError('kitchen_items', item.id, name, `Negative quantity: ${item.quantity}`);
      }
    }

    // ------------------------------------------------------------
    // Test 4: Spa Inventory Validation
    // ------------------------------------------------------------
    report.checksRun++;
    console.log('\n[4/7] Testing Spa Inventory...');
    const [spaItems] = await pool.query('SELECT * FROM spa_items');
    console.log(`  - Scanned ${spaItems.length} items.`);

    const validSpaSections = ['equipment', 'products'];

    for (const item of spaItems) {
      const name = item.name;
      if (name !== name.trim()) {
        addWarning('spa_items', item.id, name, `Item name has leading/trailing whitespaces: "${name}"`);
      }
      if (!validSpaSections.includes(item.section)) {
        addError('spa_items', item.id, name, `Invalid section "${item.section}". Allowed: ${validSpaSections.join(', ')}`);
      }
      if (item.quantity < 0) {
        addError('spa_items', item.id, name, `Negative quantity: ${item.quantity}`);
      }
    }

    // ------------------------------------------------------------
    // Test 5: Laundry Inventory Validation
    // ------------------------------------------------------------
    report.checksRun++;
    console.log('\n[5/7] Testing Laundry Inventory...');
    const [laundryItems] = await pool.query('SELECT * FROM laundry_items');
    console.log(`  - Scanned ${laundryItems.length} items.`);

    for (const item of laundryItems) {
      const name = item.name;
      if (name !== name.trim()) {
        addWarning('laundry_items', item.id, name, `Item name has leading/trailing whitespaces: "${name}"`);
      }
      if (item.quantity < 0) {
        addError('laundry_items', item.id, name, `Negative quantity: ${item.quantity}`);
      }
    }

    // ------------------------------------------------------------
    // Test 6: Gym Inventory Validation
    // ------------------------------------------------------------
    report.checksRun++;
    console.log('\n[6/7] Testing Gym Inventory...');
    const [gymItems] = await pool.query('SELECT * FROM gym_inventory');
    console.log(`  - Scanned ${gymItems.length} items.`);

    for (const item of gymItems) {
      const name = item.name;
      if (name !== name.trim()) {
        addWarning('gym_inventory', item.id, name, `Item name has leading/trailing whitespaces: "${name}"`);
      }
      if (item.quantity < 0) {
        addError('gym_inventory', item.id, name, `Negative quantity: ${item.quantity}`);
      }
    }

    // ------------------------------------------------------------
    // Test 7: Duplicate Name Detection
    // ------------------------------------------------------------
    report.checksRun++;
    console.log('\n[7/7] Testing for Duplicate Item Names...');
    const tablesToCheck = ['kitchen_items', 'spa_items', 'shop_items', 'laundry_items', 'gym_inventory', 'supplies_items'];
    for (const table of tablesToCheck) {
      const [duplicates] = await pool.query(`
        SELECT name, COUNT(*) as count 
        FROM \`${table}\` 
        WHERE is_active = 1 
        GROUP BY name 
        HAVING count > 1
      `);
      if (duplicates.length > 0) {
        for (const dup of duplicates) {
          addWarning(table, null, dup.name, `Duplicate active items named "${dup.name}" detected (${dup.count} entries).`);
        }
      }
    }

    // ------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------
    console.log('\n============================================================');
    console.log('TEST SUMMARY');
    console.log('============================================================');
    console.log(`Checks Run: ${report.checksRun} Tests`);
    console.log(`Status: ${report.passed ? 'PASS' : 'FAIL'}`);
    console.log(`Errors Found: ${report.errors.length}`);
    console.log(`Warnings Found: ${report.warnings.length}`);
    console.log('============================================================\n');

    if (report.errors.length > 0) {
      console.log('ERRORS LIST (Must be corrected for 100% data integrity):');
      console.table(report.errors);
    }

    if (report.warnings.length > 0) {
      console.log('\nWARNINGS LIST (Recommended to clean up/check):');
      console.table(report.warnings);
    }

    if (report.passed) {
      console.log('🎉 Excellent! Your database and catalog alignments are 100% correct.');
    }

  } catch (err) {
    console.error('Fatal testing error:', err.message);
  } finally {
    if (pool) await pool.end();
  }
}

runTest();
