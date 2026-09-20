-- Forever Friends unlock remote trading at friendship level 5. The original
-- production schema predates that feature and only permits the first four
-- friendship labels.
SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'trades'
      AND column_name = 'trade_friendship_level'
      AND column_type NOT LIKE '%Forever%'
  ),
  'ALTER TABLE trades MODIFY COLUMN trade_friendship_level ENUM(''Good'', ''Great'', ''Ultra'', ''Best'', ''Forever'') NOT NULL DEFAULT ''Good''',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
