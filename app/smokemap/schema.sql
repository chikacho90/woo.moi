-- smokemap schema (Neon Postgres)
-- 적용: psql $DATABASE_URL < app/smokemap/schema.sql

CREATE TABLE IF NOT EXISTS smokemap_spots (
  id            SERIAL PRIMARY KEY,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  address       TEXT,
  name          TEXT,
  amenities     JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_official   BOOLEAN NOT NULL DEFAULT FALSE,
  source        TEXT NOT NULL CHECK (source IN ('user', 'public_data', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  creator_anon_id TEXT
);

CREATE INDEX IF NOT EXISTS smokemap_spots_latlng_idx ON smokemap_spots (lat, lng);
CREATE INDEX IF NOT EXISTS smokemap_spots_official_idx ON smokemap_spots (is_official);

-- 흡연자 평가: 장소별 같은 anon_id는 한 번만
CREATE TABLE IF NOT EXISTS smokemap_smoker_ratings (
  id          SERIAL PRIMARY KEY,
  spot_id     INT NOT NULL REFERENCES smokemap_spots(id) ON DELETE CASCADE,
  rating      TEXT NOT NULL CHECK (rating IN ('comfortable', 'ok', 'inappropriate')),
  anon_id     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (spot_id, anon_id)
);

CREATE INDEX IF NOT EXISTS smokemap_ratings_spot_idx ON smokemap_smoker_ratings (spot_id);

-- 주민/비흡연자 불편 신고: 장소별 같은 anon_id는 한 번만
CREATE TABLE IF NOT EXISTS smokemap_resident_complaints (
  id          SERIAL PRIMARY KEY,
  spot_id     INT NOT NULL REFERENCES smokemap_spots(id) ON DELETE CASCADE,
  reason      TEXT CHECK (reason IN ('smoke', 'butts', 'sensitive_area', 'other')),
  detail      TEXT,
  anon_id     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (spot_id, anon_id)
);

CREATE INDEX IF NOT EXISTS smokemap_complaints_spot_idx ON smokemap_resident_complaints (spot_id);
