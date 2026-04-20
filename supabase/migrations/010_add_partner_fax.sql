-- 거래처에 팩스번호 컬럼 추가
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'fax'
  ) THEN
    ALTER TABLE partners ADD COLUMN fax VARCHAR(20);
  END IF;
END $$;
