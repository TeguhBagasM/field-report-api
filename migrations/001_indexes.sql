-- 001: index komposit untuk pola query laporan/dashboard.
-- Aman diulang (IF NOT EXISTS). Dijalankan manual via `npm run db:migrate`,
-- TIDAK otomatis saat startup agar deploy serverless tidak berlomba (race).
CREATE INDEX IF NOT EXISTS idx_reports_created_by_created_at
  ON reports (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status_created_at
  ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_report_decided_at
  ON report_approvals (report_id, decided_at DESC);
