package main

import (
	"fmt"
	"sort"
	"strings"

	"github.com/sirupsen/logrus"
)

var (
	instanceColumns = map[string]bool{}
)

func resolveInstanceSchema() error {
	if err := loadInstanceColumns(); err != nil {
		return fmt.Errorf("load instances columns: %w", err)
	}

	missing := requiredMissingInstanceColumns()
	if len(missing) > 0 {
		sort.Strings(missing)
		return fmt.Errorf("instances schema missing required columns: %s", strings.Join(missing, ", "))
	}

	logrus.Info("instances schema validated; canonical ownership column is_caught")
	return nil
}

func requiredMissingInstanceColumns() []string {
	required := []string{
		"instance_id",
		"user_id",
		"pokemon_id",
		"variant_id",
		"registered",
		"is_caught",
		"is_for_trade",
		"is_wanted",
		"most_wanted",
		"caught_tags",
		"trade_tags",
		"wanted_tags",
		"not_trade_list",
		"not_wanted_list",
		"trade_filters",
		"wanted_filters",
		"wanted_size_preferences",
		"fusion",
		"disabled",
		"last_update",
		"date_added",
	}

	missing := make([]string, 0)
	for _, col := range required {
		if !instanceHasColumn(col) {
			missing = append(missing, col)
		}
	}
	return missing
}

func columnExists(tableName, columnName string) (bool, error) {
	var count int64
	if err := DB.Raw(
		`SELECT COUNT(*)
		   FROM information_schema.columns
		  WHERE table_schema = DATABASE()
		    AND table_name = ?
		    AND column_name = ?`,
		tableName,
		columnName,
	).Scan(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func loadInstanceColumns() error {
	type row struct {
		ColumnName string `gorm:"column:COLUMN_NAME"`
	}
	var rows []row
	if err := DB.Raw(
		`SELECT COLUMN_NAME
		   FROM information_schema.columns
		  WHERE table_schema = DATABASE()
		    AND table_name = 'instances'`,
	).Scan(&rows).Error; err != nil {
		return err
	}

	next := make(map[string]bool, len(rows))
	for _, r := range rows {
		name := strings.TrimSpace(r.ColumnName)
		if name == "" {
			continue
		}
		next[name] = true
	}
	instanceColumns = next
	return nil
}

func instanceHasColumn(column string) bool {
	return instanceColumns[column]
}

func filterInstanceColumns(fields map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(fields))
	for k, v := range fields {
		if instanceHasColumn(k) {
			out[k] = v
		}
	}
	return out
}
