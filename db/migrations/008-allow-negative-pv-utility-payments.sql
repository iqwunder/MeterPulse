ALTER TABLE pv_utility_payments
  DROP CONSTRAINT chk_pv_payment_amount,
  ADD CONSTRAINT chk_pv_payment_amount CHECK (
    received_gross IS NULL OR received_gross BETWEEN -9999999999.99 AND 9999999999.99
  );
