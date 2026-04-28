import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { GetUserParams } from "@workspace/api-zod";
import { getAuth, clerkClient } from "@clerk/express";
import { z } from "zod/v4";
import crypto from "crypto";
import { sendEmail, fireAndForget } from "../lib/email";
import { welcomeTemplate, verifyEmailTemplate } from "../lib/email-templates";
import { getSiteUrl } from "../lib/config";

const router: IRouter = Router();

function randomSuffix(): string {
  return crypto.randomBytes(3).toString("hex");
}

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

function formatUserPrivate(u: typeof usersTable.$inferSelect) {
  return {
    ...formatUserPublic(u),
    isAdmin: u.isAdmin,
    themePreference: u.themePreference,
  };
}

/**
 * GET /users/verify-email?token=<token>
 *
 * Verifies the email address by matching the one-time token stored in the DB.
 * Marks the user as verified and clears the token on success.
 */
router.get("/users/verify-email", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: "Missing verification token." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.verificationToken, token));

  if (!user) {
    res.status(400).json({ error: "Invalid or expired verification token." });
    return;
  }

  await db
    .update(usersTable)
    .set({ emailVerified: true, verificationToken: null })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Email verified successfully. You can now log in." });
});

/**
 * POST /users/resend-verification
 *
 * Sends (or re-sends) an email verification link to the authenticated user.
 * Requires Clerk authentication. Only useful when emailVerified is false.
 */
router.post("/users/resend-verification", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId));

  if (!user) {
    res.status(404).json({ error: "User profile not found" });
    return;
  }

  if (user.emailVerified) {
    res.status(400).json({ error: "Email address is already verified." });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  await db
    .update(usersTable)
    .set({ verificationToken: token })
    .where(eq(usersTable.id, user.id));

  fireAndForget(
    getSiteUrl().then((siteUrl) => {
      const verifyUrl = `${siteUrl}/verify-email?token=${encodeURIComponent(token)}`;
      const { subject, html, text } = verifyEmailTemplate({
        username: user.username,
        verifyUrl,
        siteUrl,
      });
      return sendEmail({ to: user.email, subject, html, text, template: "verify-email" });
    }),
  );

  res.json({ message: "Verification email sent. Please check your inbox." });
});

router.get("/users", async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.joinedAt);
  res.json(users.map(formatUserPublic));
});

/**
 * GET /users/me
 *
 * Returns the current Clerk-authenticated user's profile from our DB,
 * creating the record on first sign-in. Falls back to email matching for
 * users who existed before Clerk was added.
 */
router.get("/users/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId));

    // Track whether this is a genuinely new account (insert) vs. an existing
    // account being merged in via email match. Welcome email is only sent for
    // new accounts; merged accounts already received a welcome email previously.
    let isNewUser = false;

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const primaryEmail =
        clerkUser.emailAddresses.find(
          (e) => e.id === clerkUser.primaryEmailAddressId,
        )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

      if (primaryEmail) {
        [user] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, primaryEmail));

        if (user) {
          // Existing account found by email — merge it with the Clerk identity.
          // isNewUser remains false; no welcome email should be sent.
          [user] = await db
            .update(usersTable)
            .set({ clerkId: userId, emailVerified: true })
            .where(eq(usersTable.id, user.id))
            .returning();
        }
      }

      if (!user) {
        // No existing account found — this is a genuinely new user.
        const baseUsername =
          clerkUser.username ??
          clerkUser.firstName ??
          primaryEmail?.split("@")[0] ??
          `user_${randomSuffix()}`;

        let username = baseUsername;
        const [existing] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.username, username));
        if (existing) {
          username = `${baseUsername}_${randomSuffix()}`;
        }

        [user] = await db
          .insert(usersTable)
          .values({
            clerkId: userId,
            username,
            email: primaryEmail ?? `${userId}@clerk.local`,
            isAiPersona: false,
            emailVerified: true,
          })
          .returning();

        // Mark as new only after a successful insert so the flag reflects
        // the actual outcome rather than the intent ahead of the DB call.
        isNewUser = !!user;

        if (isNewUser && primaryEmail) {
          fireAndForget(
            getSiteUrl().then((siteUrl) => {
              const { subject, html, text } = welcomeTemplate({ username, siteUrl });
              return sendEmail({ to: primaryEmail, subject, html, text, template: "welcome" });
            }),
          );
        }
      }
    }

    res.json(formatUserPrivate(user));
  } catch (err) {
    req.log?.error?.({ err }, "GET /users/me failed");
    res.status(500).json({ error: "Failed to load user profile" });
  }
});

const ThemePreferenceBody = z.object({
  theme: z.enum(["light", "dark"]),
});

router.patch("/users/me/theme", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
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
    .where(eq(usersTable.clerkId, userId));

  if (!user) {
    res.status(404).json({ error: "User profile not found" });
    return;
  }

  await db
    .update(usersTable)
    .set({ themePreference: parsed.data.theme })
    .where(eq(usersTable.id, user.id));

  res.json({ theme: parsed.data.theme });
});

/**
 * POST /users/legacy-login
 *
 * Migration bridge for users who registered before Clerk.
 * Verifies the stored bcrypt password hash, then either:
 * - Creates a Clerk sign-in token (if the user already has a Clerk account), or
 * - Creates a Clerk user account and returns a sign-in token.
 *
 * The frontend uses the returned `signInToken` with clerk.client.signIn.create()
 * (strategy: "ticket") to establish a Clerk session without re-registration.
 */
const LegacyLoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/users/legacy-login", async (req, res): Promise<void> => {
  const parsed = LegacyLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (!user.passwordHash) {
      // User was created without a password (e.g. AI persona or already migrated)
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Legacy passwords were hashed with SHA-256 (no salt) before Clerk was added.
    const hashedInput = crypto.createHash("sha256").update(password).digest("hex");
    const valid = hashedInput === user.passwordHash;
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Find or create a Clerk user for this email
    let clerkUserId = user.clerkId;
    if (!clerkUserId) {
      const clerkUsers = await clerkClient.users.getUserList({ emailAddress: [email] });
      if (clerkUsers.data.length > 0) {
        clerkUserId = clerkUsers.data[0].id;
      } else {
        // Create the Clerk user (no password — they'll use email magic link going forward)
        const created = await clerkClient.users.createUser({
          emailAddress: [email],
          firstName: user.username,
          skipPasswordRequirement: true,
        });
        clerkUserId = created.id;
      }
      // Link the Clerk account to the DB user
      await db.update(usersTable).set({ clerkId: clerkUserId, emailVerified: true }).where(eq(usersTable.id, user.id));
    }

    // Create a short-lived sign-in token so the client can establish a Clerk session
    const tokenResource = await clerkClient.signInTokens.createSignInToken({
      userId: clerkUserId,
      expiresInSeconds: 60,
    });

    res.json({ signInToken: tokenResource.token });
  } catch (err) {
    req.log?.error?.({ err }, "POST /users/legacy-login failed");
    res.status(500).json({ error: "Login failed" });
  }
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
