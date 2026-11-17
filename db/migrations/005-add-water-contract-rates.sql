ALTER TABLE utility_contracts
  ADD COLUMN wastewater_price DECIMAL(12, 6) NULL AFTER condition_number,
  ADD COLUMN rainwater_price_per_sqm DECIMAL(12, 6) NULL AFTER wastewater_price,
  ADD COLUMN sealed_area_sqm DECIMAL(12, 4) NULL AFTER rainwater_price_per_sqm,
  ADD CONSTRAINT chk_water_contract_rates CHECK (
    utility <> 'water' OR (
      wastewater_price IS NOT NULL AND wastewater_price >= 0 AND
      rainwater_price_per_sqm IS NOT NULL AND rainwater_price_per_sqm >= 0 AND
      sealed_area_sqm IS NOT NULL AND sealed_area_sqm >= 0
    )
  );
