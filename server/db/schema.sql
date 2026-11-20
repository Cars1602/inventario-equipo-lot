CREATE TABLE IF NOT EXISTS componentes (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(150) NOT NULL,
  categoria VARCHAR(60)  NOT NULL DEFAULT 'Otro',
  cantidad  INTEGER      NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  proyecto  VARCHAR(120),
  imagen    TEXT          -- base64 (data URL)
);
