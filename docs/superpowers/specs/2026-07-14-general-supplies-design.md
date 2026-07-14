# Design Spec: General Supplies Integration

This document outlines the design for integrating the **General Supplies** page into the Swiss Side Management Suite, featuring a hierarchical folder layout.

## Goals
* Integrate the pre-existing `/general-supplies` module into the client sidebar navigation and main React routes.
* Ensure database compatibility by creating/updating the `general_supplies` table schema with hierarchical routing columns (`is_folder`, `parent_id`).
* Add REST endpoints support for transactions (withdrawals and restocking), validating decimal values and custom transaction dates.

## Architecture

### 1. Database Schema
We need to ensure the `general_supplies` table exists with support for folders:
```sql
CREATE TABLE IF NOT EXISTS `general_supplies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `quantity` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `unit` VARCHAR(50) NOT NULL DEFAULT 'pcs',
  `reorder_level` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `category` ENUM('Cleaning','Toiletries','Office','Other') NOT NULL DEFAULT 'Other',
  `notes` TEXT DEFAULT NULL,
  `is_folder` TINYINT(1) DEFAULT 0,
  `parent_id` INT DEFAULT NULL,
  `classification` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `deleted_by` INT DEFAULT NULL,
  `deleted_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`parent_id`) REFERENCES `general_supplies`(`id`) ON DELETE SET NULL,
  INDEX `idx_name` (`name`),
  INDEX `idx_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

If the table already exists from an older schema without folders, we run these migrations:
```sql
ALTER TABLE `general_supplies` ADD COLUMN IF NOT EXISTS `is_folder` TINYINT(1) DEFAULT 0;
ALTER TABLE `general_supplies` ADD COLUMN IF NOT EXISTS `parent_id` INT DEFAULT NULL;
ALTER TABLE `general_supplies` ADD COLUMN IF NOT EXISTS `classification` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `general_supplies` ADD COLUMN IF NOT EXISTS `is_active` TINYINT(1) DEFAULT 1;
ALTER TABLE `general_supplies` ADD COLUMN IF NOT EXISTS `deleted_by` INT DEFAULT NULL;
ALTER TABLE `general_supplies` ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME DEFAULT NULL;
```

### 2. Frontend Changes
* **Sidebar Menu**: Add `General Supplies` to `Sidebar.jsx` using the `Folder` icon.
* **Router**: Mount `GeneralSupplies` page under `/general-supplies` in `App.jsx`.
* **Modals**: Verify and ensure the restocking and withdrawal modals inside `GeneralSupplies.jsx` utilize:
  * Decimal number inputs (step `0.01`).
  * Custom `transaction_date` field with the "Edit Date" toggle banner.

### 3. Backend Changes
* Verify that `backend/src/routes/generalSupplies.js` matches the custom date and decimal requirements (already verified as having `parseFloat` and checking transaction date bounds).
