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