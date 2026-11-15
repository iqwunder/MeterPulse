ALTER TABLE readings DROP COLUMN IF EXISTS name;
ALTER TABLE readings DROP CONSTRAINT IF EXISTS chk_readings_value_positive;
ALTER TABLE readings ADD CONSTRAINT chk_readings_value_nonnegative CHECK (value >= 0);