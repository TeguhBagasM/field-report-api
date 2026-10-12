import { pool } from "../db/pool.js";
import type { UserRole } from "../types/express.js";
import {
  REPORT_COLUMNS,
  REPORT_FROM,
  toReportItem,
  type ReportItem,
  type ReportRow,
} from "./report.service.js";

export type DashboardSummary = {
  totals: { total: number; pending: number; approved: number; rejected: number };
  trend: Array<{ date: string; count: number }>;
  recent: ReportItem[];
  awaiting: ReportItem[] | null;
  myDecisions: { total: number; approved: number; rejected: number } | null;
  users: {
    total: number;
    active: number;
    inactive: number;
    byRole: { admin: number; pelapor: number; approver: number };
  } | null;
};

export async function getDashboardSummary(requester: {
  id: number;
  role: UserRole;
}): Promise<DashboardSummary> {
  // Pelapor hanya melihat miliknya; approver/admin melihat semua.
  const ownerFilter = requester.role === "pelapor" ? "r.created_by = $1" : "TRUE";
  const ownerParams = requester.role === "pelapor" ? [requester.id] : [];

  const totalsPromise = pool.query<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE r.status = 'pending')::int AS pending,
            COUNT(*) FILTER (WHERE r.status = 'approved')::int AS approved,
            COUNT(*) FILTER (WHERE r.status = 'rejected')::int AS rejected
     FROM reports r WHERE ${ownerFilter}`,
    ownerParams,
  );

  // 7 hari terakhir; hari tanpa laporan tetap muncul dengan count 0.
  // Bucketing tanggal mengikuti timezone sesi DB (konsisten dengan NOW() saat insert).
  const trendPromise = pool.query<{ date: string; count: number }>(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS date, COUNT(r.id)::int AS count
     FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') AS d(day)
     LEFT JOIN reports r
       ON DATE(r.created_at) = d.day::date
       ${requester.role === "pelapor" ? "AND r.created_by = $1" : ""}
     GROUP BY d.day ORDER BY d.day`,
    ownerParams,
  );

  const recentPromise = pool.query<ReportRow>(
    `SELECT ${REPORT_COLUMNS} FROM ${REPORT_FROM}
     WHERE ${ownerFilter}
     ORDER BY r.created_at DESC, r.id DESC LIMIT 5`,
    ownerParams,
  );

  const awaitingPromise =
    requester.role === "approver"
      ? pool.query<ReportRow>(
          `SELECT ${REPORT_COLUMNS} FROM ${REPORT_FROM}
           WHERE r.status = 'pending'
           ORDER BY r.created_at ASC, r.id ASC LIMIT 5`,
        )
      : Promise.resolve(null);

  const myDecisionsPromise =
    requester.role === "approver"
      ? pool.query<{ total: number; approved: number; rejected: number }>(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE decision = 'approved')::int AS approved,
                  COUNT(*) FILTER (WHERE decision = 'rejected')::int AS rejected
           FROM report_approvals WHERE approver_id = $1`,
          [requester.id],
        )
      : Promise.resolve(null);

  const usersPromise =
    requester.role === "admin"
      ? (async () => {
          // Dua agregat independen dijalankan paralel (tetap 2 query ringan,
          // tanpa N+1; bentuk JSON tidak berubah).
          const [aggResult, rolesResult] = await Promise.all([
            pool.query<{
              total: number;
              active: number;
              inactive: number;
            }>(
              `SELECT COUNT(*)::int AS total,
                      COUNT(*) FILTER (WHERE is_active)::int AS active,
                      COUNT(*) FILTER (WHERE NOT is_active)::int AS inactive
               FROM users`,
            ),
            pool.query<{ role: UserRole; count: number }>(
              `SELECT role, COUNT(*)::int AS count FROM users GROUP BY role`,
            ),
          ]);
          const byRole = { admin: 0, pelapor: 0, approver: 0 };
          for (const r of rolesResult.rows) {
            byRole[r.role] = r.count;
          }
          return { ...aggResult.rows[0], byRole };
        })()
      : Promise.resolve(null);

  const [totals, trend, recent, awaiting, myDecisions, users] = await Promise.all([
    totalsPromise,
    trendPromise,
    recentPromise,
    awaitingPromise,
    myDecisionsPromise,
    usersPromise,
  ]);

  return {
    totals: totals.rows[0],
    trend: trend.rows,
    recent: recent.rows.map(toReportItem),
    awaiting: awaiting ? awaiting.rows.map(toReportItem) : null,
    myDecisions: myDecisions ? myDecisions.rows[0] : null,
    users,
  };
}
