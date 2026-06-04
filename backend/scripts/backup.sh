#!/bin/bash
# =========================================================================
# SWISS SIDE DB BACKUP SCRIPT
# This script dumps the MySQL database, compresses the output to save space,
# and cleans up backups older than 30 days.
#
# To run this script daily at 2:00 AM, add the following cron job:
# 0 2 * * * /path/to/backup.sh
# =========================================================================

# Strict error handling
set -e

DB_USER="${DB_USER:-swisiuoy_swiss_user}"
DB_PASS="${DB_PASS:-@Synchro2026}"
DB_NAME="${DB_NAME:-swisiuoy_swiss_side_db}"
DB_HOST="${DB_HOST:-localhost}"

# Target backup directory (defaults to a directory in the user's home)
BACKUP_DIR="${BACKUP_DIR:-$HOME/swissside_backups}"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/swiss_side_backup_$DATE.sql"

# 1. Create target backup directory if it does not exist
mkdir -p "$BACKUP_DIR"

# 2. Execute mysqldump
echo "Starting database dump for database: $DB_NAME..."
mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_FILE"

# 3. Gzip file to compress
echo "Compressing backup file..."
gzip "$BACKUP_FILE"

# 4. Remove backups older than 30 days to free up space
echo "Cleaning up backups older than 30 days..."
find "$BACKUP_DIR" -type f -name "swiss_side_backup_*.sql.gz" -mtime +30 -delete

echo "Database backup process completed successfully! File location: ${BACKUP_FILE}.gz"
