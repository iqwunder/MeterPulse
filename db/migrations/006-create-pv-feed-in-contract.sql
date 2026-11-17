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
