import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { GetUserParams } from "@workspace/api-zod";
import { getAuth, clerkClient } from "@clerk/express";
import { z } from "zod/v4";
import crypto from "crypto";

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
          [user] = await db
            .update(usersTable)
            .set({ clerkId: userId, emailVerified: true })
            .where(eq(usersTable.id, user.id))
            .returning();
        }
      }

      if (!user) {
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
