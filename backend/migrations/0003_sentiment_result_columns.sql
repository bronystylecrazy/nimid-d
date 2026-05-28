ALTER TABLE fortune_readings ADD COLUMN sentiment_feeling_now INTEGER;
ALTER TABLE fortune_readings ADD COLUMN sentiment_wellbeing_now INTEGER;
ALTER TABLE fortune_readings ADD COLUMN sentiment_score INTEGER;
ALTER TABLE fortune_readings ADD COLUMN sentiment_reason_th TEXT;
ALTER TABLE fortune_readings ADD COLUMN sentiment_model TEXT;
ALTER TABLE fortune_readings ADD COLUMN sentiment_status TEXT;

CREATE INDEX IF NOT EXISTS idx_fortune_readings_sentiment_score
  ON fortune_readings(sentiment_score);
