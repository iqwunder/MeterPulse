ALTER TABLE utility_contracts
  ADD COLUMN heating_value DECIMAL(12, 6) NULL AFTER unit_price,
  ADD COLUMN condition_number DECIMAL(12, 6) NULL AFTER heating_value,
  ADD CONSTRAINT chk_gas_contract_factors CHECK (
    utility <> 'gas' OR (heating_value > 0 AND condition_number > 0)
  );
