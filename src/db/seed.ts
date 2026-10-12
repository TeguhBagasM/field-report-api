import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

type SeedUser = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "pelapor" | "approver";
};

const USERS: SeedUser[] = [
  { name: "Admin", email: "admin@demo.com", password: "Admin123!", role: "admin" },
  { name: "Pelapor Satu", email: "pelapor1@demo.com", password: "Pelapor123!", role: "pelapor" },
  { name: "Pelapor Dua", email: "pelapor2@demo.com", password: "Pelapor123!", role: "pelapor" },
  { name: "Approver", email: "approver@demo.com", password: "Approver123!", role: "approver" },
];

type SeedReport = {
  ownerEmail: string;
  name: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  createdDaysAgo: number;
  note?: string;
  decidedDaysAgo?: number;
};

const REPORTS: SeedReport[] = [
  {
    ownerEmail: "pelapor1@demo.com",
    name: "Kerusakan jalan Jl. Merdeka",
    description: "Aspal berlubang di depan pasar, membahayakan pengendara motor.",
    status: "pending",
    createdDaysAgo: 1,
  },
  {
    ownerEmail: "pelapor1@demo.com",
    name: "Lampu PJU mati di Jl. Sudirman",
    description: "Tiga titik lampu penerangan jalan mati sejak seminggu terakhir.",
    status: "approved",
    createdDaysAgo: 6,
    note: "Disetujui, diteruskan ke dinas perhubungan.",
    decidedDaysAgo: 4,
  },
  {
    ownerEmail: "pelapor1@demo.com",
    name: "Banjir di RT 05 RW 02",
    description: "Genangan setinggi lutut setelah hujan deras, saluran tersumbat sampah.",
    status: "rejected",
    createdDaysAgo: 8,
    note: "Ditolak, lokasi di luar wilayah kerja.",
    decidedDaysAgo: 7,
  },
  {
    ownerEmail: "pelapor2@demo.com",
    name: "Jembatan rusak di Desa Suka Maju",
    description: "Papan jembatan retak, hanya bisa dilalui pejalan kaki.",
    status: "pending",
    createdDaysAgo: 2,
  },
  {
    ownerEmail: "pelapor2@demo.com",
    name: "Sampah menumpuk di Pasar Pagi",
    description: "Tumpukan sampah belum diangkut tiga hari, menimbulkan bau.",
    status: "approved",
    createdDaysAgo: 5,
    note: "Disetujui, pengangkutan dijadwalkan besok.",
    decidedDaysAgo: 3,
  },
  {
    ownerEmail: "pelapor2@demo.com",
    name: "Pipa air bocor di Jl. Anggrek",
    description: "Air menggenang di bahu jalan, diduga pipa PDAM bocor.",
    status: "rejected",
    createdDaysAgo: 9,
    note: "Ditolak, duplikat dari laporan sebelumnya.",
    decidedDaysAgo: 8,
  },
];

async function main(): Promise<void> {
  // Idempoten: kosongkan dulu lalu isi ulang dari nol.
  await pool.query("TRUNCATE report_approvals, reports, users RESTART IDENTITY CASCADE");

  const userIds = new Map<string, number>();
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const { rows } = await pool.query<{ id: number }>(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
      [u.name, u.email, passwordHash, u.role],
    );
    userIds.set(u.email, rows[0].id);
  }

  const approverId = userIds.get("approver@demo.com");
  if (approverId === undefined) {
    throw new Error("Approver seed tidak ditemukan");
  }

  let approvalCount = 0;
  for (const r of REPORTS) {
    const ownerId = userIds.get(r.ownerEmail);
    if (ownerId === undefined) {
      throw new Error(`Owner seed tidak ditemukan: ${r.ownerEmail}`);
    }
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO reports (name, description, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW() - ($5 || ' days')::INTERVAL, NOW() - ($5 || ' days')::INTERVAL)
       RETURNING id`,
      [r.name, r.description, r.status, ownerId, String(r.createdDaysAgo)],
    );
    const reportId = rows[0].id;

    if (r.status !== "pending") {
      await pool.query(
        `INSERT INTO report_approvals (report_id, approver_id, decision, note, decided_at)
         VALUES ($1, $2, $3, $4, NOW() - ($5 || ' days')::INTERVAL)`,
        [reportId, approverId, r.status, r.note ?? null, String(r.decidedDaysAgo ?? r.createdDaysAgo)],
      );
      approvalCount += 1;
    }
  }

  console.log(`Seed selesai: ${USERS.length} users, ${REPORTS.length} reports, ${approvalCount} approvals`);
  await pool.end();
}

main().catch(async (e) => {
  console.error("Gagal seed DB:", e);
  await pool.end();
  process.exit(1);
});
