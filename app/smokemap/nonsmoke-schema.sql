-- 금연구역 테이블 (OSM 소스 기반 벌크 시드)
CREATE TABLE IF NOT EXISTS smokemap_nonsmoke_zones (
  id         SERIAL PRIMARY KEY,
  osm_id     BIGINT,
  osm_type   TEXT,
  name       TEXT,
  category   TEXT NOT NULL CHECK (category IN ('school','kindergarten','hospital','park','public')),
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  radius_m   INT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'osm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (osm_type, osm_id)
);

CREATE INDEX IF NOT EXISTS smokemap_nonsmoke_latlng_idx ON smokemap_nonsmoke_zones (lat, lng);
CREATE INDEX IF NOT EXISTS smokemap_nonsmoke_category_idx ON smokemap_nonsmoke_zones (category);
