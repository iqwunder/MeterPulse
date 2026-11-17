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

CREATE TABLE IF NOT EXISTS utility_contracts (
  utility ENUM('electricity', 'gas', 'water') NOT NULL,
  contract_start DATE NOT NULL,
  monthly_fee DECIMAL(12, 4) NOT NULL,
  unit_price DECIMAL(12, 6) NOT NULL,
  heating_value DECIMAL(12, 6) NULL,
  condition_number DECIMAL(12, 6) NULL,
  wastewater_price DECIMAL(12, 6) NULL,
  rainwater_price_per_sqm DECIMAL(12, 6) NULL,
  sealed_area_sqm DECIMAL(12, 4) NULL,
  monthly_advance DECIMAL(12, 4) NOT NULL,
  contract_end DATE NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (utility),
  CONSTRAINT chk_contract_monthly_fee_nonnegative CHECK (monthly_fee >= 0),
  CONSTRAINT chk_contract_unit_price_nonnegative CHECK (unit_price >= 0),
  CONSTRAINT chk_contract_monthly_advance_nonnegative CHECK (monthly_advance >= 0),
  CONSTRAINT chk_contract_dates CHECK (contract_end IS NULL OR contract_end >= contract_start),
  CONSTRAINT chk_gas_contract_factors CHECK (
    utility <> 'gas' OR (heating_value > 0 AND condition_number > 0)
  ),
  CONSTRAINT chk_water_contract_rates CHECK (
    utility <> 'water' OR (
      wastewater_price IS NOT NULL AND wastewater_price >= 0 AND
      rainwater_price_per_sqm IS NOT NULL AND rainwater_price_per_sqm >= 0 AND
      sealed_area_sqm IS NOT NULL AND sealed_area_sqm >= 0
    )
  )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pv_feed_in_contract (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  gross_price_per_kwh DECIMAL(12, 6) NOT NULL,
  vat_rate DECIMAL(5, 2) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_pv_contract_singleton CHECK (id = 1),
  CONSTRAINT chk_pv_contract_price_nonnegative CHECK (gross_price_per_kwh >= 0),
  CONSTRAINT chk_pv_contract_vat_rate CHECK (vat_rate >= 0 AND vat_rate <= 100)
) ENGINE=InnoDB;