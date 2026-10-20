#!/bin/bash

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups"

mkdir -p "$BACKUP_DIR"

docker exec library_mysql \
    mysqldump \
    -u root \
    -p'root_password' \
    library_db \
    > "$BACKUP_DIR/backup_$DATE.sql"

echo "Database backup created: $BACKUP_DIR/backup_$DATE.sql"