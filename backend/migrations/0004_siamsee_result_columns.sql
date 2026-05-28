ALTER TABLE fortune_readings ADD COLUMN siamsee_status TEXT;
ALTER TABLE fortune_readings ADD COLUMN siamsee_reading TEXT;
ALTER TABLE fortune_readings ADD COLUMN siamsee_fields_json TEXT;
ALTER TABLE fortune_readings ADD COLUMN siamsee_condition TEXT;
ALTER TABLE fortune_readings ADD COLUMN siamsee_condition_context_json TEXT;
ALTER TABLE fortune_readings ADD COLUMN siamsee_model TEXT;
ALTER TABLE fortune_readings ADD COLUMN siamsee_stick_number INTEGER;
ALTER TABLE fortune_readings ADD COLUMN siamsee_stick_json TEXT;
ALTER TABLE ritual_states ADD COLUMN siamsee_stick_json TEXT;

CREATE INDEX IF NOT EXISTS idx_fortune_readings_siamsee_condition
  ON fortune_readings(siamsee_condition);
