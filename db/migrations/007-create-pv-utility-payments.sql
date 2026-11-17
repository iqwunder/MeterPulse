CREATE TABLE IF NOT EXISTS pv_utility_payments (
  payment_year SMALLINT UNSIGNED NOT NULL,
  payment_month TINYINT UNSIGNED NOT NULL,
  received_gross DECIMAL(12, 2) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_year, payment_month),
  CONSTRAINT chk_pv_payment_year CHECK (payment_year >= 1900 AND payment_year <= 9999),
  CONSTRAINT chk_pv_payment_month CHECK (payment_month >= 1 AND payment_month <= 12),
  CONSTRAINT chk_pv_payment_amount CHECK (received_gross IS NULL OR received_gross >= 0)
) ENGINE=InnoDB;
