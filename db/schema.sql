CREATE DATABASE IF NOT EXISTS meterpulse
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE meterpulse;

CREATE TABLE IF NOT EXISTS readings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  utility ENUM('electricity', 'gas', 'water') NOT NULL,
  value DECIMAL(12, 3) NOT NULL,
  unit VARCHAR(8) NOT NULL,
  recorded_at DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_readings_utility_date (utility, recorded_at),
  INDEX idx_readings_recorded_at (recorded_at),
  CONSTRAINT chk_readings_value_nonnegative CHECK (value >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pv_daily_readings (
  recorded_at DATE NOT NULL,
  generated_kwh DECIMAL(12, 3) NOT NULL,
  consumed_kwh DECIMAL(12, 3) NOT NULL,
  feed_in_kwh DECIMAL(12, 3) NOT NULL,
  grid_import_kwh DECIMAL(12, 3) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (recorded_at),
  CONSTRAINT chk_pv_generated_nonnegative CHECK (generated_kwh >= 0),
  CONSTRAINT chk_pv_consumed_nonnegative CHECK (consumed_kwh >= 0),
  CONSTRAINT chk_pv_feed_in_nonnegative CHECK (feed_in_kwh >= 0),
  CONSTRAINT chk_pv_grid_import_nonnegative CHECK (grid_import_kwh >= 0)
) ENGINE=InnoDB;