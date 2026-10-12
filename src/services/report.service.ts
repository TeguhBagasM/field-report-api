import { pool } from "../db/pool.js";
import type { UserRole } from "../types/express.js";
import { HttpError } from "../utils/httpError.js";
import type {
  ListReportsQuery,
  ReportBodyInput,
  UpdateStatusInput,
} from "../schemas/report.schema.js";

export type ReportStatus = "pending" | "approved" | "rejected";

export type DecisionInfo = {
  approver: { id: number; name: string };
  decision: Exclude<ReportStatus, "pending">;
  note: string | null;
  decidedAt: string;
};

export type ReportItem = {
  id: number;
  name: string;
  description: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  reporter: { id: number; name: string };
  lastDecision: DecisionInfo | null;
};

export type ApprovalItem = {
  id: number;
  approver: { id: number; name: string };
  decision: Exclude<ReportStatus, "pending">;
  note: string | null;
  decidedAt: string;
};

export type ReportDetail = ReportItem & { approvals: ApprovalItem[] };

export type ReportRow = {
  id: number;
  name: string;
  description: string;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  created_by: number;
  reporter_name: string;
  last_approval_id: number | null;
  last_decision: Exclude<ReportStatus, "pending"> | null;
  last_note: string | null;
  last_decided_at: string | null;
  last_approver_id: number | null;
  last_approver_name: string | null;
};

export const REPORT_COLUMNS = `
  r.id, r.name, r.description, r.status, r.created_at, r.updated_at,
  r.created_by, u.name AS reporter_name,
  la.id AS last_approval_id, la.decision AS last_decision, la.note AS last_note,
  la.decided_at AS last_decided_at, la.approver_id AS last_approver_id,
  au.name AS last_approver_name
`;

export const REPORT_FROM = `
  reports r
  JOIN users u ON u.id = r.created_by
  LEFT JOIN LATERAL (
    SELECT a.id, a.decision, a.note, a.decided_at, a.approver_id
    FROM report_approvals a
    WHERE a.report_id = r.id
    ORDER BY a.decided_at DESC, a.id DESC
    LIMIT 1
  ) la ON TRUE
  LEFT JOIN users au ON au.id = la.approver_id
`;

/** Satu-satunya mapper row -> JSON agar bentuk respons konsisten. */
export function toReportItem(row: ReportRow): ReportItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reporter: { id: row.created_by, name: row.reporter_name },
    lastDecision:
      row.last_approval_id === null ||
      row.last_decision === null ||
      row.last_decided_at === null ||
      row.last_approver_id === null ||
      row.last_approver_name === null
        ? null
        : {
            approver: { id: row.last_approver_id, name: row.last_approver_name },
            decision: row.last_decision,
            note: row.last_note,
            decidedAt: row.last_decided_at,
          },
  };
}

async function findReportRow(id: number): Promise<ReportRow | undefined> {
  const { rows } = await pool.query<ReportRow>(
    `SELECT ${REPORT_COLUMNS} FROM ${REPORT_FROM} WHERE r.id = $1`,
    [id],
  );
  return rows[0];
}

export async function createReport(data: ReportBodyInput, createdBy: number): Promise<ReportItem> {
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO reports (name, description, status, created_by) VALUES ($1, $2, 'pending', $3) RETURNING id",
    [data.name, data.description, createdBy],
  );
  const row = await findReportRow(rows[0].id);
  if (!row) {
    throw new HttpError(500, "Gagal membaca laporan yang baru dibuat");
  }
  return toReportItem(row);
}

export type ListReportsFilter = ListReportsQuery & {
  requesterId: number;
  requesterRole: UserRole;
};

export async function listReports(
  filter: ListReportsFilter,
): Promise<{ data: ReportItem[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const page = Math.max(1, filter.page);
  const limit = Math.min(100, Math.max(1, filter.limit));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: Array<string | number> = [];
  let i = 1;

  // Pelapor WAJIB difilter miliknya di SQL.
  if (filter.requesterRole === "pelapor") {
    conditions.push(`r.created_by = $${i++}`);
    values.push(filter.requesterId);
  }
  if (filter.status !== undefined) {
    conditions.push(`r.status = $${i++}`);
    values.push(filter.status);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: countRows } = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM reports r ${where}`,
    values,
  );
  const total = Number(countRows[0].total);

  const { rows } = await pool.query<ReportRow>(
    `SELECT ${REPORT_COLUMNS} FROM ${REPORT_FROM}
     ${where} ORDER BY r.created_at DESC, r.id DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...values, limit, offset],
  );

  return {
    data: rows.map(toReportItem),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getReportDetail(
  id: number,
  requester: { id: number; role: UserRole },
): Promise<ReportDetail> {
  const row = await findReportRow(id);
  // Pelapor yang mengakses milik orang lain -> 404 (bukan 403).
  if (!row || (requester.role === "pelapor" && row.created_by !== requester.id)) {
    throw new HttpError(404, "Laporan tidak ditemukan");
  }

  const { rows: approvalRows } = await pool.query<{
    id: number;
    decision: ApprovalItem["decision"];
    note: string | null;
    decided_at: string;
    approver_id: number;
    approver_name: string;
  }>(
    `SELECT a.id, a.decision, a.note, a.decided_at, a.approver_id, u.name AS approver_name
     FROM report_approvals a JOIN users u ON u.id = a.approver_id
     WHERE a.report_id = $1
     ORDER BY a.decided_at DESC, a.id DESC`,
    [id],
  );

  return {
    ...toReportItem(row),
    approvals: approvalRows.map((a) => ({
      id: a.id,
      approver: { id: a.approver_id, name: a.approver_name },
      decision: a.decision,
      note: a.note,
      decidedAt: a.decided_at,
    })),
  };
}

export async function updateReport(
  id: number,
  requesterId: number,
  data: ReportBodyInput,
): Promise<ReportItem> {
  // Atomik: hanya pemilik + status pending yang bisa ter-update.
  const { rowCount, rows } = await pool.query<{ id: number }>(
    `UPDATE reports SET name = $1, description = $2, updated_at = NOW()
     WHERE id = $3 AND created_by = $4 AND status = 'pending'
     RETURNING id`,
    [data.name, data.description, id, requesterId],
  );

  if ((rowCount ?? 0) > 0 && rows[0]) {
    const row = await findReportRow(rows[0].id);
    if (!row) {
      throw new HttpError(500, "Gagal membaca laporan yang baru diubah");
    }
    return toReportItem(row);
  }

  const { rows: existing } = await pool.query<{ created_by: number; status: ReportStatus }>(
    "SELECT created_by, status FROM reports WHERE id = $1",
    [id],
  );
  const found = existing[0];
  if (!found || found.created_by !== requesterId) {
    throw new HttpError(404, "Laporan tidak ditemukan");
  }
  throw new HttpError(409, "Laporan tidak bisa diedit karena sudah diputuskan");
}

export async function changeStatus(
  reportId: number,
  approverId: number,
  data: UpdateStatusInput,
): Promise<ReportDetail> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ status: ReportStatus }>(
      "SELECT status FROM reports WHERE id = $1 FOR UPDATE",
      [reportId],
    );
    const current = rows[0];
    if (!current) {
      throw new HttpError(404, "Laporan tidak ditemukan");
    }
    if (current.status === data.status) {
      throw new HttpError(409, `Laporan sudah berstatus ${data.status}`);
    }

    await client.query("UPDATE reports SET status = $2, updated_at = NOW() WHERE id = $1", [
      reportId,
      data.status,
    ]);
    await client.query(
      "INSERT INTO report_approvals (report_id, approver_id, decision, note) VALUES ($1, $2, $3, $4)",
      [reportId, approverId, data.status, data.note ?? null],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  // Dibaca setelah COMMIT; bentuk JSON sama persis seperti GET /reports/:id.
  return getReportDetail(reportId, { id: approverId, role: "approver" });
}
