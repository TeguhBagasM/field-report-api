import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import type { UserRole } from "../types/express.js";
import { HttpError } from "../utils/httpError.js";

export type AuthUser = {
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
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, name, email, password_hash, role, is_active, created_at
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  const user = rows[0];

  const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !passwordOk) {
    throw new HttpError(401, "Email atau password salah");
  }

  if (!user.is_active) {
    throw new HttpError(403, "Akun dinonaktifkan");
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

  return { token, user: toAuthUser(user) };
}

export async function getCurrentUser(id: number): Promise<AuthUser> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, name, email, password_hash, role, is_active, created_at
     FROM users WHERE id = $1`,
    [id],
  );
  const user = rows[0];
  if (!user) {
    throw new HttpError(404, "User tidak ditemukan");
  }
  if (!user.is_active) {
    throw new HttpError(401, "Token tidak valid");
  }
  return toAuthUser(user);
}
