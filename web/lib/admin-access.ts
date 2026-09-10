export const OWNER_EMAIL = "nyu1997@gmail.com";

export type AdminEntry = {
  email: string;
  role: "owner" | "admin";
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isOwner = (email: string) => normalizeEmail(email) === OWNER_EMAIL;

export const hasAdminAccess = async (
  email: string,
  db: Pick<D1Database, "prepare">,
): Promise<boolean> => {
  if (isOwner(email)) return true;
  const admin = await db
    .prepare("SELECT email FROM admins WHERE email = ?")
    .bind(normalizeEmail(email))
    .first<{ email: string }>();
  return Boolean(admin);
};

export const listAdmins = async (
  db: Pick<D1Database, "prepare">,
): Promise<AdminEntry[]> => {
  const { results } = await db
    .prepare("SELECT email FROM admins ORDER BY email")
    .all<{ email: string }>();
  return [
    { email: OWNER_EMAIL, role: "owner" },
    ...results.map(({ email }) => ({ email, role: "admin" as const })),
  ];
};

export const addAdmin = async (
  input: unknown,
  addedBy: string,
  db: Pick<D1Database, "prepare">,
) => {
  if (!isOwner(addedBy)) throw new Error("Owner access required.");
  const email = typeof input === "string" ? normalizeEmail(input) : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (isOwner(email)) throw new Error("This account is already the owner.");
  const result = await db
    .prepare(
      "INSERT INTO admins (email, created_by, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING",
    )
    .bind(email, normalizeEmail(addedBy), new Date().toISOString())
    .run();
  if (!result.meta.changes) throw new Error("This email is already an admin.");
};
