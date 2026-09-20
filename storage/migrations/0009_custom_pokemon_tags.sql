CREATE TABLE IF NOT EXISTS tags (
  tag_id CHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  parent VARCHAR(16) NOT NULL,
  name VARCHAR(40) NOT NULL,
  color CHAR(7) NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NULL DEFAULT NULL,
  deleted_at DATETIME(6) NULL DEFAULT NULL,
  PRIMARY KEY (tag_id),
  KEY idx_tags_user_active_parent_sort (user_id, deleted_at, parent, sort),
  KEY idx_tags_user_parent_name (user_id, parent, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS instance_tags (
  tag_id CHAR(36) NOT NULL,
  instance_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (tag_id, instance_id),
  KEY idx_instance_tags_instance (instance_id),
  KEY idx_instance_tags_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = IF(
  NOT EXISTS(
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'tags'
      AND index_name = 'idx_tags_user_active_parent_sort'
  ),
  'ALTER TABLE tags ADD INDEX idx_tags_user_active_parent_sort (user_id, deleted_at, parent, sort)',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @sql = IF(
  NOT EXISTS(
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'tags'
      AND index_name = 'idx_tags_user_parent_name'
  ),
  'ALTER TABLE tags ADD INDEX idx_tags_user_parent_name (user_id, parent, name)',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @sql = IF(
  NOT EXISTS(
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'instance_tags'
      AND index_name = 'idx_instance_tags_instance'
  ),
  'ALTER TABLE instance_tags ADD INDEX idx_instance_tags_instance (instance_id)',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @sql = IF(
  NOT EXISTS(
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'instance_tags'
      AND index_name = 'idx_instance_tags_user'
  ),
  'ALTER TABLE instance_tags ADD INDEX idx_instance_tags_user (user_id)',
  'SELECT 1'
);
PREPARE migration_statement FROM @sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
