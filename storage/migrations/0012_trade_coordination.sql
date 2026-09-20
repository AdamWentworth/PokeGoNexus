SET @sql = IF(
  NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_profiles'
      AND column_name = 'coordination_method'
  ),
  'ALTER TABLE user_profiles ADD COLUMN coordination_method VARCHAR(16) NOT NULL DEFAULT ''campfire'' AFTER trainer_code_visibility',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @sql = IF(
  NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_profiles'
      AND column_name = 'coordination_handle'
  ),
  'ALTER TABLE user_profiles ADD COLUMN coordination_handle VARCHAR(80) NULL AFTER coordination_method',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @sql = IF(
  NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_profiles'
      AND column_name = 'share_trade_contact'
  ),
  'ALTER TABLE user_profiles ADD COLUMN share_trade_contact TINYINT(1) NOT NULL DEFAULT 1 AFTER coordination_handle',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

-- Preserve the intent of trainers who had already made their Trainer Code
-- private before accepted-trade sharing became a distinct preference.
UPDATE user_profiles
SET share_trade_contact = 0
WHERE trainer_code_visibility = 'private';
