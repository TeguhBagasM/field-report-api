-- Reset (khusus dev, menghapus semua data)
DROP TABLE IF EXISTS report_approvals, reports, users CASCADE;
DROP TYPE IF EXISTS report_status, user_role;

CREATE TYPE user_role AS ENUM ('admin', 'pelapor', 'approver');
CREATE TYPE report_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reports (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  status      report_status NOT NULL DEFAULT 'pending',
  created_by  INT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reports_created_by ON reports(created_by);
CREATE INDEX idx_reports_status ON reports(status);

CREATE TABLE report_approvals (
  id          SERIAL PRIMARY KEY,
  report_id   INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  approver_id INT NOT NULL REFERENCES users(id),
  decision    report_status NOT NULL CHECK (decision IN ('approved','rejected')),
  note        TEXT,
  decided_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_approvals_report ON report_approvals(report_id);