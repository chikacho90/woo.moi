-- ledger schema (Neon Postgres)
-- 적용: /api/ledger 최초 호출 시 자동으로 CREATE TABLE IF NOT EXISTS 실행됨
-- 수동 적용: psql $DATABASE_URL < app/ledger/schema.sql

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount      BIGINT NOT NULL,
  -- category: e.g. 월급, 식비, 교통, 주거, 대출상환, 이체, 저축 등
  category    TEXT NOT NULL,
  subcategory TEXT,
  -- account: e.g. 토스, 우리, 하나, 현금, 카드
  account     TEXT,
  memo        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_transactions_date_idx ON ledger_transactions (date DESC);
CREATE INDEX IF NOT EXISTS ledger_transactions_category_idx ON ledger_transactions (category);
CREATE INDEX IF NOT EXISTS ledger_transactions_type_idx ON ledger_transactions (type);
