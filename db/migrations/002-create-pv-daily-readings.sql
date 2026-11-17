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