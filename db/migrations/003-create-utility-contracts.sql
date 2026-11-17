CREATE TABLE IF NOT EXISTS utility_contracts (
  utility ENUM('electricity', 'gas', 'water') NOT NULL,
  contract_start DATE NOT NULL,
  monthly_fee DECIMAL(12, 4) NOT NULL,
  unit_price DECIMAL(12, 6) NOT NULL,
  monthly_advance DECIMAL(12, 4) NOT NULL,
  contract_end DATE NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (utility),
  CONSTRAINT chk_contract_monthly_fee_nonnegative CHECK (monthly_fee >= 0),
  CONSTRAINT chk_contract_unit_price_nonnegative CHECK (unit_price >= 0),
  CONSTRAINT chk_contract_monthly_advance_nonnegative CHECK (monthly_advance >= 0),
  CONSTRAINT chk_contract_dates CHECK (contract_end IS NULL OR contract_end >= contract_start)
) ENGINE=InnoDB;