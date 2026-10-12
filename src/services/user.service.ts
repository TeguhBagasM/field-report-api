import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";
import type { UserRole } from "../types/express.js";
import { HttpError } from "../utils/httpError.js";
import type { CreateUserInput, UpdateUserInput } from "../schemas/user.schema.js";

export type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

const PUBLIC_COLUMNS = "id, name, email, role, is_active, created_at";

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

export async function listUsers(): Promise<PublicUser[]> {
  const { rows } = await pool.query<UserRow>(
    `SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY created_at DESC`,
  );
  return rows.map(toPublicUser);
}

export async function createUser(data: CreateUserInput): Promise<PublicUser> {
  const passwordHash = await bcrypt.hash(data.password, 10);
  try {
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${PUBLIC_COLUMNS}`,
      [data.name, data.email, passwordHash, data.role],
    );
    return toPublicUser(rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, "Email sudah terdaftar");
    }
    throw err;
  }
}

export async function updateUser(
  id: number,
  data: UpdateUserInput,
  actorId: number,
): Promise<PublicUser> {
  const { rows } = await pool.query<UserRow>(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`,
    [id],
  );
  const existing = rows[0];
  if (!existing) {
    throw new HttpError(404, "User tidak ditemukan");
  }

  if (id === actorId) {
    if (data.isActive === false) {
      throw new HttpError(409, "Admin tidak boleh menonaktifkan dirinya sendiri");
    }
    if (data.role !== undefined && data.role !== existing.role) {
      throw new HttpError(409, "Admin tidak boleh mengubah role dirinya sendiri");
    }
  }

  const sets: string[] = [];
  const values: Array<string | boolean> = [];
  let i = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${i++}`);
    values.push(data.name);
  }
  if (data.role !== undefined) {
    sets.push(`role = $${i++}`);
    values.push(data.role);
  }
  if (data.isActive !== undefined) {
    sets.push(`is_active = $${i++}`);
    values.push(data.isActive);
  }
  if (data.password !== undefined) {
    sets.push(`password_hash = $${i++}`);
    values.push(await bcrypt.hash(data.password, 10));
  }

  if (sets.length === 0) {
    return toPublicUser(existing);
  }

  const { rows: updated } = await pool.query<UserRow>(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $${i} RETURNING ${PUBLIC_COLUMNS}`,
    [...values, id],
  );
  return toPublicUser(updated[0]);
}
