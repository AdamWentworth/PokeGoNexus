SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'instances'
  ) AND NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'instances'
      AND column_name = 'wanted_size_preferences'
  ),
  'ALTER TABLE instances ADD COLUMN wanted_size_preferences JSON NULL',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
