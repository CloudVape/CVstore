import { Router, type IRouter } from "express";
import { eq, asc, sql } from "drizzle-orm";
import { db, commentsTable, usersTable, postsTable } from "@workspace/db";
import {
  ListCommentsParams,
  CreateCommentParams,
  CreateCommentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/posts/:postId/comments", async (req, res): Promise<void> => {
  const params = ListCommentsParams.safeParse({ postId: req.params.postId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select({
      comment: commentsTable,
      authorName: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
    })
    .from(commentsTable)
    .leftJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
    .where(eq(commentsTable.postId, params.data.postId))
    .orderBy(asc(commentsTable.createdAt));

  res.json(
    rows.map(({ comment, authorName, authorAvatarUrl }) => ({
      ...comment,
      authorName: authorName ?? "Unknown",
      authorAvatarUrl,
    }))
  );
});

router.post("/posts/:postId/comments", async (req, res): Promise<void> => {
  const pathParams = CreateCommentParams.safeParse({ postId: req.params.postId });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }
  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [comment] = await db
    .insert(commentsTable)
    .values({
      postId: pathParams.data.postId,
      authorId: parsed.data.authorId,
      content: parsed.data.content,
      isAiGenerated: false,
    })
    .returning();

  await db
    .update(postsTable)
    .set({ commentCount: sql`${postsTable.commentCount} + 1` })
    .where(eq(postsTable.id, pathParams.data.postId));

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, comment.authorId));

  res.status(201).json({
    ...comment,
    authorName: user?.username ?? "Unknown",
    authorAvatarUrl: user?.avatarUrl ?? null,
  });
});

export default router;
