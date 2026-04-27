import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  CreateUserBody,
  LoginUserBody,
  GetUserParams,
} from "@workspace/api-zod";
import crypto from "crypto";
import { sendEmail, fireAndForget } from "../lib/email";
import { welcomeTemplate, verifyEmailTemplate, passwordResetTemplate } from "../lib/email-templates";
import { z } from "zod/v4";

const router: IRouter = Router();

const SITE_URL = process.env.SITE_URL ?? "https://vapevault.com";
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function newSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function newSecureToken(): string {
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
    emailVerified: u.emailVerified,
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
    themePreference: u.themePreference,
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

  const sessionToken = newSessionToken();
  const verificationToken = newSecureToken();
  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      email,
      passwordHash: hashPassword(password),
      bio: bio ?? null,
      isAiPersona: false,
      sessionToken,
      emailVerified: false,
      verificationToken,
    })
    .returning();

  req.log.info({ userId: user.id }, "New user registered");

  const verifyUrl = `${SITE_URL}/verify-email?token=${verificationToken}`;
  const verifyTpl = verifyEmailTemplate({ username, verifyUrl });
  fireAndForget(sendEmail({ ...verifyTpl, to: email, template: "verify-email" }));

  const welcomeTpl = welcomeTemplate(username);
  fireAndForget(sendEmail({ ...welcomeTpl, to: email, template: "welcome" }));

  res.status(201).json(formatUserPrivate(user));
});

router.get("/users/verify-email", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.verificationToken, token));

  if (!user) {
    res.status(400).json({ error: "Invalid or expired verification link" });
    return;
  }
  if (user.emailVerified) {
    res.json({ message: "Email already verified" });
    return;
  }

  const expiryMs = ONE_DAY_MS;
  const tokenAge = Date.now() - new Date(user.joinedAt).getTime();
  if (tokenAge > expiryMs) {
    res.status(400).json({ error: "Verification link has expired. Please request a new one." });
    return;
  }

  await db
    .update(usersTable)
    .set({ emailVerified: true, verificationToken: null })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Email verified successfully. You can now log in." });
});

const ForgotPasswordBody = z.object({
  email: z.string().email(),
});

router.post("/users/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }
  const { email } = parsed.data;

  res.json({ message: "If that email is registered, a password reset link has been sent." });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.isAiPersona) return;

  const resetToken = newSecureToken();
  const expiry = new Date(Date.now() + ONE_HOUR_MS);

  await db
    .update(usersTable)
    .set({ passwordResetToken: resetToken, passwordResetExpiry: expiry })
    .where(eq(usersTable.id, user.id));

  const resetUrl = `${SITE_URL}/reset-password?token=${resetToken}`;
  const tpl = passwordResetTemplate({ username: user.username, resetUrl });
  fireAndForget(sendEmail({ ...tpl, to: email, template: "password-reset" }));
});

const ResetPasswordBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

router.post("/users/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { token, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.passwordResetToken, token));

  if (!user || !user.passwordResetExpiry) {
    res.status(400).json({ error: "Invalid or expired reset link" });
    return;
  }

  if (new Date(user.passwordResetExpiry) < new Date()) {
    res.status(400).json({ error: "Reset link has expired. Please request a new one." });
    return;
  }

  await db
    .update(usersTable)
    .set({
      passwordHash: hashPassword(password),
      passwordResetToken: null,
      passwordResetExpiry: null,
      sessionToken: newSessionToken(),
    })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Password reset successfully. Please log in with your new password." });
});

const ThemePreferenceBody = z.object({
  theme: z.enum(["light", "dark"]),
});

router.patch("/users/me/theme", async (req, res): Promise<void> => {
  const auth = req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  const token = m ? m[1].trim() : "";
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = ThemePreferenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "theme must be 'light' or 'dark'" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.sessionToken, token));

  if (!user) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }

  await db
    .update(usersTable)
    .set({ themePreference: parsed.data.theme })
    .where(eq(usersTable.id, user.id));

  res.json({ theme: parsed.data.theme });
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
