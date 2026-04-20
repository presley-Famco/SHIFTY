/**
 * Storage layer.
 *
 * Model:
 *  - users (drivers + admins)
 *  - shift_offerings: admin-created shifts (date, start/end time, label, notes)
 *  - shift_claims: drivers claim availability for an offering; admin approves/denies
 *  - inspections: one per driver per date
 *  - inspection_photos: exactly 5 per inspection (front/back/driver/passenger/selfie)
 *
 * Uses Vercel Postgres when POSTGRES_URL is set. Falls back to JSON file locally.
 */
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { sql } from '@vercel/postgres';

export type Role = 'driver' | 'admin';
export type DriverStatus = 'active_compliant' | 'pending' | 'removed_archived';
export type PlanningWeekMode = 'next_week' | 'current_week';

export type User = {
  id: string;
  email: string;
  name: string;
  phone: string;
  password_hash: string;
  role: Role;
  driver_status: DriverStatus | null;
  created_at: string;
};

export type ShiftOffering = {
  id: string;
  date: string;          // YYYY-MM-DD
  start_time: string;    // HH:MM (24h)
  end_time: string;      // HH:MM (24h)
  label: string;         // e.g. "Early AM - Partner X"
  notes: string | null;
  week_start: string;    // YYYY-MM-DD (Monday)
  created_at: string;
  created_by: string;    // admin user id
};

export type ClaimStatus = 'pending' | 'approved' | 'denied';

export type ShiftClaim = {
  id: string;
  offering_id: string;
  user_id: string;
  status: ClaimStatus;
  decision_reason: string | null;
  created_at: string;
  decided_at: string | null;
};

export type PhotoLabel = 'front' | 'back' | 'driver_side' | 'passenger_side' | 'selfie';

export const PHOTO_LABELS: { key: PhotoLabel; title: string; hint: string }[] = [
  { key: 'front', title: 'Front of vehicle', hint: 'Full front, license plate visible' },
  { key: 'back', title: 'Back of vehicle', hint: 'Full rear, license plate visible' },
  { key: 'driver_side', title: 'Driver side', hint: 'Full side profile' },
  { key: 'passenger_side', title: 'Passenger side', hint: 'Full side profile' },
  { key: 'selfie', title: 'Selfie in uniform', hint: 'Clear view of uniform' },
];

export type InspectionPhoto = {
  id: string;
  inspection_id: string;
  label: PhotoLabel;
  data_url: string;       // MVP: base64. Production: swap for Vercel Blob / S3.
  created_at: string;
};

export type Inspection = {
  id: string;
  user_id: string;
  date: string;           // YYYY-MM-DD
  created_at: string;
};

type DB = {
  users: User[];
  offerings: ShiftOffering[];
  claims: ShiftClaim[];
  inspections: Inspection[];
  photos: InspectionPhoto[];
  settings?: {
    planning_week_mode?: PlanningWeekMode;
  };
};

const USE_POSTGRES = !!process.env.POSTGRES_URL;

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return '';
}

/** Owner accounts that always resolve as admin even if DB role / email drift. */
const TRUSTED_ADMIN_EMAILS = ['presley.r.iii@gmail.com'];
/** Neon user id(s) for the same owner — bypasses email typos in DB. */
const TRUSTED_ADMIN_IDS = ['mo7p58lo4mc2swyc'];
/** When JWT has no `email` claim (older tokens), map `sub` → owner email for bootstrap + recovery. */
const TRUSTED_ADMIN_EMAIL_BY_ID: Record<string, string> = {
  mo7p58lo4mc2swyc: 'presley.r.iii@gmail.com',
};

/**
 * JWT `sub` values allowed for bootstrap when tokens lack `email`.
 * Entries may be raw user ids, or owner emails — emails are resolved to ids via lookup (same env mistake-tolerant).
 */
async function trustedBootstrapSubIdSet(): Promise<Set<string>> {
  const set = new Set<string>([
    ...TRUSTED_ADMIN_IDS,
    ...Object.keys(TRUSTED_ADMIN_EMAIL_BY_ID),
  ]);
  const segments =
    process.env.SHIFTY_TRUSTED_BOOTSTRAP_SUB_IDS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  for (const segment of segments) {
    if (segment.includes('@')) {
      const row = await findUserByEmail(segment.toLowerCase());
      if (row) set.add(row.id);
    } else {
      set.add(segment);
    }
  }
  return set;
}

function makeBootstrapUserId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

/**
 * MVP: verified session cookie but no user row (empty DB, new Neon branch, env drift).
 * Creates a minimal admin row so FKs and admin actions work. Password is random — sign-in still works via existing session until they use password reset or re-signup flow.
 */
export async function ensureTrustedAdminPlaceholder(
  jwtSub: string | null,
  emailClaim: string | null,
): Promise<User | null> {
  const fromClaim = emailClaim?.trim().toLowerCase() ?? '';
  const fromSub =
    jwtSub && TRUSTED_ADMIN_EMAIL_BY_ID[jwtSub]
      ? TRUSTED_ADMIN_EMAIL_BY_ID[jwtSub].trim().toLowerCase()
      : '';

  let email = fromClaim || fromSub;
  // Legacy JWTs: no email claim; only trusted `sub` values may bind to owner email for bootstrap.
  if (!email && jwtSub && (await trustedBootstrapSubIdSet()).has(jwtSub)) {
    const envPick = process.env.SHIFTY_OWNER_EMAIL?.trim().toLowerCase() ?? '';
    email =
      (envPick && TRUSTED_ADMIN_EMAILS.includes(envPick) ? envPick : '') ||
      TRUSTED_ADMIN_EMAILS[0];
  }
  if (!email || !TRUSTED_ADMIN_EMAILS.includes(email)) return null;

  if (jwtSub) {
    const byId = await findUserById(jwtSub);
    if (byId) return byId;
  }
  const existingByEmail = await findUserByEmail(email);
  if (existingByEmail) return existingByEmail;

  const id = jwtSub?.trim() || makeBootstrapUserId();
  const password_hash = bcrypt.hashSync(`mvp-bootstrap-lockout-${email}-${id}`, 10);

  try {
    await createUser({
      id,
      email,
      name: 'Dispatch admin',
      phone: '0000000000',
      password_hash,
      role: 'admin',
      driver_status: null,
      created_at: new Date().toISOString(),
    });
  } catch {
    const recovered = await findUserByEmail(email);
    if (recovered) return recovered;
    const recoveredById = jwtSub ? await findUserById(jwtSub) : null;
    return recoveredById;
  }

  return findUserById(id);
}

/** Force admin for trusted owner rows (also called from auth after session lookup). */
export function applyTrustedAdminBypass(user: User): User {
  const email = user.email.trim().toLowerCase();
  const byId = TRUSTED_ADMIN_IDS.includes(user.id);
  const byEmail = TRUSTED_ADMIN_EMAILS.includes(email);
  if (!byId && !byEmail) return user;
  return { ...user, role: 'admin', driver_status: null };
}

/** Coerce DB text (manual edits often use Admin/DRIVER) to app Role. */
export function normalizeUser(u: User): User {
  const rawRole = String(u.role ?? '').trim().toLowerCase();
  const role: Role = rawRole === 'admin' ? 'admin' : 'driver';
  let driver_status: DriverStatus | null = null;
  if (role === 'driver') {
    const s = String(u.driver_status ?? '').trim().toLowerCase();
    if (s === 'pending') driver_status = 'pending';
    else if (s === 'removed_archived') driver_status = 'removed_archived';
    else driver_status = 'active_compliant';
  }
  const out: User = { ...u, role, driver_status };
  return applyTrustedAdminBypass(out);
}

// ---------- JSON file fallback ----------

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const empty: DB = {
      users: [],
      offerings: [],
      claims: [],
      inspections: [],
      photos: [],
      settings: { planning_week_mode: 'next_week' },
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(empty, null, 2));
  }
}
function readDB(): DB {
  ensureFile();
  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as DB;
  if (!db.settings) db.settings = {};
  if (!db.settings.planning_week_mode) db.settings.planning_week_mode = 'next_week';
  return db;
}
function writeDB(db: DB): void {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// ---------- Postgres schema bootstrap ----------

let schemaReady = false;
async function ensureSchema(): Promise<void> {
  if (!USE_POSTGRES || schemaReady) return;
  await sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    driver_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS driver_status TEXT`;
  await sql`UPDATE users SET driver_status = 'active_compliant' WHERE lower(trim(role)) = 'driver' AND driver_status IS NULL`;
  await sql`CREATE TABLE IF NOT EXISTS shift_offerings (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    label TEXT NOT NULL,
    notes TEXT,
    week_start TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
  )`;
  await sql`CREATE TABLE IF NOT EXISTS shift_claims (
    id TEXT PRIMARY KEY,
    offering_id TEXT NOT NULL REFERENCES shift_offerings(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    decision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    UNIQUE (offering_id, user_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, date)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS inspection_photos (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    data_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`;
  await sql`INSERT INTO app_settings (key, value)
    VALUES ('planning_week_mode', 'next_week')
    ON CONFLICT (key) DO NOTHING`;
  schemaReady = true;
}

// ---------- Users ----------

export async function findUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<User>`SELECT
      id,
      email,
      name,
      phone,
      password_hash,
      role,
      CASE WHEN lower(trim(role)) = 'driver' THEN COALESCE(driver_status, 'active_compliant') ELSE NULL END AS driver_status,
      created_at
      FROM users
      WHERE lower(trim(email)) = ${normalizedEmail}
      ORDER BY created_at DESC
      LIMIT 1`;
    return rows[0] ? normalizeUser(rows[0]) : null;
  }
  const u =
    readDB().users.find((x) => x.email.trim().toLowerCase() === normalizedEmail) ?? null;
  if (!u) return null;
  return normalizeUser({
    ...u,
    driver_status: u.role === 'driver' ? u.driver_status ?? 'active_compliant' : null,
  });
}

export async function findUserByPhone(phone: string): Promise<User | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<User>`SELECT
      id,
      email,
      name,
      phone,
      password_hash,
      role,
      CASE WHEN lower(trim(role)) = 'driver' THEN COALESCE(driver_status, 'active_compliant') ELSE NULL END AS driver_status,
      created_at
      FROM users
      WHERE CASE
        WHEN length(regexp_replace(phone, '\D', '', 'g')) = 10 THEN regexp_replace(phone, '\D', '', 'g')
        WHEN length(regexp_replace(phone, '\D', '', 'g')) = 11 AND regexp_replace(phone, '\D', '', 'g') LIKE '1%' THEN right(regexp_replace(phone, '\D', '', 'g'), 10)
        ELSE ''
      END = ${normalized}
      ORDER BY created_at DESC
      LIMIT 1`;
    return rows[0] ? normalizeUser(rows[0]) : null;
  }
  const users = readDB().users
    .filter((u) => u.phone.replace(/\D/g, '').slice(-10) === normalized)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const u = users[0] ?? null;
  if (!u) return null;
  return normalizeUser({
    ...u,
    driver_status: u.role === 'driver' ? u.driver_status ?? 'active_compliant' : null,
  });
}

export async function findUserById(id: string): Promise<User | null> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<User>`SELECT
      id,
      email,
      name,
      phone,
      password_hash,
      role,
      CASE WHEN lower(trim(role)) = 'driver' THEN COALESCE(driver_status, 'active_compliant') ELSE NULL END AS driver_status,
      created_at
      FROM users
      WHERE id = ${id}
      LIMIT 1`;
    return rows[0] ? normalizeUser(rows[0]) : null;
  }
  const u = readDB().users.find((x) => x.id === id) ?? null;
  if (!u) return null;
  return normalizeUser({
    ...u,
    driver_status: u.role === 'driver' ? u.driver_status ?? 'active_compliant' : null,
  });
}

export async function createUser(u: User): Promise<void> {
  if (USE_POSTGRES) {
    await ensureSchema();
    await sql`INSERT INTO users (id, email, name, phone, password_hash, role, driver_status)
      VALUES (${u.id}, ${u.email}, ${u.name}, ${u.phone}, ${u.password_hash}, ${u.role}, ${u.driver_status})`;
    return;
  }
  const db = readDB();
  db.users.push(u);
  writeDB(db);
}

export async function listUsers(): Promise<User[]> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<User>`SELECT
      id,
      email,
      name,
      phone,
      password_hash,
      role,
      CASE WHEN lower(trim(role)) = 'driver' THEN COALESCE(driver_status, 'active_compliant') ELSE NULL END AS driver_status,
      created_at
      FROM users
      ORDER BY created_at DESC`;
    return rows.map((row) => normalizeUser(row));
  }
  return readDB().users.map((u) =>
    normalizeUser({
      ...u,
      driver_status: u.role === 'driver' ? u.driver_status ?? 'active_compliant' : null,
    }),
  );
}

export async function setDriverStatus(userId: string, status: DriverStatus): Promise<void> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const result = await sql<{ id: string }>`UPDATE users
      SET driver_status = ${status}
      WHERE id = ${userId} AND lower(trim(role)) = 'driver'
      RETURNING id`;
    if (result.rows.length === 0) {
      throw new Error('Driver not found.');
    }
    return;
  }
  const db = readDB();
  const u = db.users.find((x) => x.id === userId && x.role === 'driver');
  if (!u) {
    throw new Error('Driver not found.');
  }
  u.driver_status = status;
  writeDB(db);
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  if (USE_POSTGRES) {
    await ensureSchema();
    await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
    return;
  }
  const db = readDB();
  const u = db.users.find((x) => x.id === userId);
  if (u) u.password_hash = passwordHash;
  writeDB(db);
}

/** Deletes a user and dependent rows (Postgres: FK CASCADE; JSON: manual cleanup). */
export async function deleteUserById(userId: string): Promise<void> {
  if (USE_POSTGRES) {
    await ensureSchema();
    await sql`DELETE FROM users WHERE id = ${userId}`;
    return;
  }
  const db = readDB();
  const removedOfferingIds = db.offerings.filter((o) => o.created_by === userId).map((o) => o.id);
  db.offerings = db.offerings.filter((o) => o.created_by !== userId);
  db.claims = db.claims.filter(
    (c) => c.user_id !== userId && !removedOfferingIds.includes(c.offering_id),
  );
  const inspectionIds = db.inspections.filter((i) => i.user_id === userId).map((i) => i.id);
  db.photos = db.photos.filter((p) => !inspectionIds.includes(p.inspection_id));
  db.inspections = db.inspections.filter((i) => i.user_id !== userId);
  db.users = db.users.filter((u) => u.id !== userId);
  writeDB(db);
}

export async function getPlanningWeekMode(): Promise<PlanningWeekMode> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<{ value: string }>`SELECT value FROM app_settings WHERE key = 'planning_week_mode' LIMIT 1`;
    const value = rows[0]?.value;
    return value === 'current_week' ? 'current_week' : 'next_week';
  }
  return readDB().settings?.planning_week_mode === 'current_week' ? 'current_week' : 'next_week';
}

export async function setPlanningWeekMode(mode: PlanningWeekMode): Promise<void> {
  if (USE_POSTGRES) {
    await ensureSchema();
    await sql`INSERT INTO app_settings (key, value)
      VALUES ('planning_week_mode', ${mode})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    return;
  }
  const db = readDB();
  if (!db.settings) db.settings = {};
  db.settings.planning_week_mode = mode;
  writeDB(db);
}

// ---------- Shift offerings ----------

export async function createOffering(o: ShiftOffering): Promise<void> {
  if (USE_POSTGRES) {
    await ensureSchema();
    await sql`INSERT INTO shift_offerings (id, date, start_time, end_time, label, notes, week_start, created_by)
      VALUES (${o.id}, ${o.date}, ${o.start_time}, ${o.end_time}, ${o.label}, ${o.notes}, ${o.week_start}, ${o.created_by})`;
    return;
  }
  const db = readDB();
  db.offerings.push(o);
  writeDB(db);
}

export async function deleteOffering(id: string): Promise<void> {
  if (USE_POSTGRES) {
    await ensureSchema();
    await sql`DELETE FROM shift_offerings WHERE id = ${id}`;
    return;
  }
  const db = readDB();
  db.offerings = db.offerings.filter((o) => o.id !== id);
  db.claims = db.claims.filter((c) => c.offering_id !== id);
  writeDB(db);
}

export async function listOfferings(weekStart?: string): Promise<ShiftOffering[]> {
  if (USE_POSTGRES) {
    await ensureSchema();
    if (weekStart) {
      const { rows } = await sql<ShiftOffering>`SELECT * FROM shift_offerings WHERE week_start = ${weekStart} ORDER BY date, start_time`;
      return rows;
    }
    const { rows } = await sql<ShiftOffering>`SELECT * FROM shift_offerings ORDER BY date, start_time`;
    return rows;
  }
  const db = readDB();
  return db.offerings
    .filter((o) => !weekStart || o.week_start === weekStart)
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
}

export async function findOfferingById(id: string): Promise<ShiftOffering | null> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<ShiftOffering>`SELECT * FROM shift_offerings WHERE id = ${id} LIMIT 1`;
    return rows[0] ?? null;
  }
  return readDB().offerings.find((o) => o.id === id) ?? null;
}

// ---------- Claims ----------

export async function createOrUpdateClaim(c: ShiftClaim): Promise<void> {
  if (USE_POSTGRES) {
    await ensureSchema();
    await sql`INSERT INTO shift_claims (id, offering_id, user_id, status, decision_reason)
      VALUES (${c.id}, ${c.offering_id}, ${c.user_id}, ${c.status}, ${c.decision_reason})
      ON CONFLICT (offering_id, user_id) DO NOTHING`;
    return;
  }
  const db = readDB();
  const existing = db.claims.find(
    (x) => x.offering_id === c.offering_id && x.user_id === c.user_id,
  );
  if (!existing) db.claims.push(c);
  writeDB(db);
}

export async function deleteClaim(offeringId: string, userId: string): Promise<void> {
  if (USE_POSTGRES) {
    await ensureSchema();
    await sql`DELETE FROM shift_claims WHERE offering_id = ${offeringId} AND user_id = ${userId}`;
    return;
  }
  const db = readDB();
  db.claims = db.claims.filter(
    (c) => !(c.offering_id === offeringId && c.user_id === userId),
  );
  writeDB(db);
}

export async function decideClaim(
  claimId: string,
  status: ClaimStatus,
  reason: string | null,
): Promise<void> {
  const decidedAt = new Date().toISOString();
  if (USE_POSTGRES) {
    await ensureSchema();
    await sql`UPDATE shift_claims SET status = ${status}, decision_reason = ${reason}, decided_at = ${decidedAt} WHERE id = ${claimId}`;
    return;
  }
  const db = readDB();
  const c = db.claims.find((x) => x.id === claimId);
  if (c) {
    c.status = status;
    c.decision_reason = reason;
    c.decided_at = decidedAt;
  }
  writeDB(db);
}

export async function listClaimsForUser(userId: string): Promise<ShiftClaim[]> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<ShiftClaim>`SELECT * FROM shift_claims WHERE user_id = ${userId}`;
    return rows;
  }
  return readDB().claims.filter((c) => c.user_id === userId);
}

export async function listClaimsForOfferings(offeringIds: string[]): Promise<ShiftClaim[]> {
  if (offeringIds.length === 0) return [];
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<ShiftClaim>`SELECT * FROM shift_claims WHERE offering_id = ANY(${offeringIds as unknown as string})`;
    return rows;
  }
  return readDB().claims.filter((c) => offeringIds.includes(c.offering_id));
}

export async function findClaimById(id: string): Promise<ShiftClaim | null> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<ShiftClaim>`SELECT * FROM shift_claims WHERE id = ${id} LIMIT 1`;
    return rows[0] ?? null;
  }
  return readDB().claims.find((c) => c.id === id) ?? null;
}

export async function listAllClaims(): Promise<ShiftClaim[]> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<ShiftClaim>`SELECT * FROM shift_claims ORDER BY created_at DESC`;
    return rows;
  }
  return [...readDB().claims].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ---------- Inspections ----------

export async function createInspection(i: Inspection, photos: InspectionPhoto[]): Promise<boolean> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const inserted = await sql<{ id: string }>`INSERT INTO inspections (id, user_id, date)
      VALUES (${i.id}, ${i.user_id}, ${i.date})
      ON CONFLICT (user_id, date) DO NOTHING
      RETURNING id`;
    if (inserted.rows.length === 0) return false;
    for (const p of photos) {
      await sql`INSERT INTO inspection_photos (id, inspection_id, label, data_url)
        VALUES (${p.id}, ${p.inspection_id}, ${p.label}, ${p.data_url})`;
    }
    return true;
  }
  const db = readDB();
  if (db.inspections.find((x) => x.user_id === i.user_id && x.date === i.date)) return false;
  db.inspections.push(i);
  db.photos.push(...photos);
  writeDB(db);
  return true;
}

export async function listInspectionsForUser(userId: string): Promise<Inspection[]> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<Inspection>`SELECT * FROM inspections WHERE user_id = ${userId} ORDER BY date DESC`;
    return rows;
  }
  return readDB().inspections
    .filter((x) => x.user_id === userId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function listAllInspections(): Promise<Inspection[]> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<Inspection>`SELECT * FROM inspections ORDER BY date DESC, created_at DESC`;
    return rows;
  }
  return [...readDB().inspections].sort((a, b) => b.date.localeCompare(a.date));
}

export async function listPhotosForInspection(inspectionId: string): Promise<InspectionPhoto[]> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<InspectionPhoto>`SELECT * FROM inspection_photos WHERE inspection_id = ${inspectionId}`;
    return rows;
  }
  return readDB().photos.filter((p) => p.inspection_id === inspectionId);
}

export async function getInspectionByUserAndDate(
  userId: string,
  date: string,
): Promise<Inspection | null> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<Inspection>`SELECT * FROM inspections WHERE user_id = ${userId} AND date = ${date} LIMIT 1`;
    return rows[0] ?? null;
  }
  return readDB().inspections.find((x) => x.user_id === userId && x.date === date) ?? null;
}

export async function findInspectionById(id: string): Promise<Inspection | null> {
  if (USE_POSTGRES) {
    await ensureSchema();
    const { rows } = await sql<Inspection>`SELECT * FROM inspections WHERE id = ${id} LIMIT 1`;
    return rows[0] ?? null;
  }
  return readDB().inspections.find((x) => x.id === id) ?? null;
}
