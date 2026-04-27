import { Router, type IRouter } from "express";
import { desc, sql, gte } from "drizzle-orm";
import { db, usersTable, postsTable, commentsTable, categoriesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/stats/community", async (_req, res): Promise<void> => {
  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [postCount] = await db.select({ count: sql<number>`count(*)::int` }).from(postsTable);
  const [commentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(commentsTable);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [todayPosts] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postsTable)
    .where(gte(postsTable.createdAt, todayStart));

  const [topCat] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .orderBy(desc(categoriesTable.postCount))
    .limit(1);

  const onlineNow = Math.floor(Math.random() * 40) + 15;

  res.json({
    totalUsers: userCount.count,
    totalPosts: postCount.count,
    totalComments: commentCount.count,
    onlineNow,
    postsToday: todayPosts.count,
    topCategory: topCat?.name ?? "General",
  });
});

router.get("/stats/active-users", async (_req, res): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.postCount))
    .limit(8);
  res.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      isAiPersona: u.isAiPersona,
      postCount: u.postCount,
      joinedAt: u.joinedAt,
    }))
  );
});

export default router;
