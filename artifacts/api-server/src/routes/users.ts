import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  CreateUserBody,
  LoginUserBody,
  GetUserParams,
} from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function newSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Public projection — safe to return on listings and lookups by other users.
 * Deliberately omits `isAdmin` (privilege disclosure) and `sessionToken`.
 */
function formatUserPublic(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    isAiPersona: u.isAiPersona,
    postCount: u.postCount,
    joinedAt: u.joinedAt,
  };
}

/**
 * Private projection — only returned to the authenticated requester
 * (login/signup responses). Includes `isAdmin` so the client can render the
 * admin nav, and the freshly-issued `sessionToken` to be sent back as a
 * Bearer token on subsequent privileged requests.
 */
function formatUserPrivate(u: typeof usersTable.$inferSelect) {
  return {
    ...formatUserPublic(u),
    isAdmin: u.isAdmin,
    sessionToken: u.sessionToken,
  };
}

router.get("/users", async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.joinedAt);
  res.json(users.map(formatUserPublic));
});

router.post("/users/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const hash = hashPassword(password);
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user || user.passwordHash !== hash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = newSessionToken();
  const [updated] = await db
    .update(usersTable)
    .set({ sessionToken: token })
    .where(eq(usersTable.id, user.id))
    .returning();
  res.json(formatUserPrivate(updated));
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, email, password, bio } = parsed.data;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const token = newSessionToken();
  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      email,
      passwordHash: hashPassword(password),
      bio: bio ?? null,
      isAiPersona: false,
      sessionToken: token,
    })
    .returning();
  req.log.info({ userId: user.id }, "New user registered");
  res.status(201).json(formatUserPrivate(user));
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(formatUserPublic(user));
});

export default router;
