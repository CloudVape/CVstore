import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, postsTable, usersTable, categoriesTable } from "@workspace/db";
import {
  CreatePostBody,
  ListPostsQueryParams,
  GetPostParams,
  UpdatePostParams,
  UpdatePostBody,
  DeletePostParams,
  LikePostParams,
} from "@workspace/api-zod";
import { sendEmail, fireAndForget } from "../lib/email";
import { mentionNotificationTemplate } from "../lib/email-templates";
import { getSiteUrl } from "../lib/config";
import { logger } from "../lib/logger";

const MENTION_RE = /@([a-zA-Z0-9_]+)/g;

function extractMentions(text: string): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m[1]) matches.push(m[1].toLowerCase());
  }
  return [...new Set(matches)];
}

async function sendPostMentionNotifications(
  postId: number,
  content: string,
  mentionerUsername: string,
  mentionerUserId: number,
  siteUrl: string,
): Promise<void> {
  const handles = extractMentions(content);
  if (handles.length === 0) return;
  const postUrl = `${siteUrl}/forum/post/${postId}`;
  for (const handle of handles) {
    const [mentioned] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, handle));
    if (
      !mentioned ||
      mentioned.id === mentionerUserId ||
      !mentioned.notificationsEnabled ||
      mentioned.isAiPersona
    ) continue;
    const tpl = mentionNotificationTemplate({
      username: mentioned.username,
      mentionerUsername,
      context: content.slice(0, 300),
      contextUrl: postUrl,
      notificationsUrl: `${siteUrl}/settings`,
      siteUrl,
    });
    await sendEmail({ ...tpl, to: mentioned.email, template: "mention" });
  }
}

const router: IRouter = Router();

async function getEnrichedPost(postId: number) {
  const rows = await db
    .select({
      post: postsTable,
      authorName: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
      categoryName: categoriesTable.name,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .leftJoin(categoriesTable, eq(postsTable.categoryId, categoriesTable.id))
    .where(eq(postsTable.id, postId));
  if (!rows[0]) return null;
  const { post, authorName, authorAvatarUrl, categoryName } = rows[0];
  return {
    ...post,
    authorName: authorName ?? "Unknown",
    authorAvatarUrl,
    categoryName,
  };
}

async function listEnrichedPosts(where?: any, limit = 30, offset = 0) {
  const query = db
    .select({
      post: postsTable,
      authorName: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
      categoryName: categoriesTable.name,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .leftJoin(categoriesTable, eq(postsTable.categoryId, categoriesTable.id))
    .orderBy(desc(postsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const rows = where ? await query.where(where) : await query;
  return rows.map(({ post, authorName, authorAvatarUrl, categoryName }) => ({
    ...post,
    authorName: authorName ?? "Unknown",
    authorAvatarUrl,
    categoryName,
  }));
}

router.get("/posts", async (req, res): Promise<void> => {
  const params = ListPostsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { categoryId, limit, offset } = params.data;
  const where = categoryId ? eq(postsTable.categoryId, categoryId) : undefined;
  const posts = await listEnrichedPosts(where, limit ?? 30, offset ?? 0);
  res.json(posts);
});

router.get("/posts/trending", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      post: postsTable,
      authorName: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
      categoryName: categoriesTable.name,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .leftJoin(categoriesTable, eq(postsTable.categoryId, categoriesTable.id))
    .orderBy(desc(sql`${postsTable.likes} + ${postsTable.commentCount} * 2`))
    .limit(10);
  res.json(
    rows.map(({ post, authorName, authorAvatarUrl, categoryName }) => ({
      ...post,
      authorName: authorName ?? "Unknown",
      authorAvatarUrl,
      categoryName,
    }))
  );
});

router.get("/posts/latest", async (_req, res): Promise<void> => {
  const posts = await listEnrichedPosts(undefined, 20, 0);
  res.json(posts);
});

router.get("/posts/:id", async (req, res): Promise<void> => {
  const params = GetPostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const post = await getEnrichedPost(params.data.id);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(post);
});

router.post("/posts", async (req, res): Promise<void> => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [post] = await db
    .insert(postsTable)
    .values({
      ...parsed.data,
      tags: parsed.data.tags ?? [],
      sourceUrl: parsed.data.sourceUrl ?? null,
      isAiGenerated: false,
    })
    .returning();

  await db
    .update(categoriesTable)
    .set({ postCount: sql`${categoriesTable.postCount} + 1` })
    .where(eq(categoriesTable.id, parsed.data.categoryId));

  await db
    .update(usersTable)
    .set({ postCount: sql`${usersTable.postCount} + 1` })
    .where(eq(usersTable.id, parsed.data.authorId));

  const enriched = await getEnrichedPost(post.id);
  res.status(201).json(enriched);

  if (parsed.data.authorId) {
    const [author] = await db
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, parsed.data.authorId));
    if (author) {
      fireAndForget(
        getSiteUrl().then((siteUrl) =>
          sendPostMentionNotifications(
            post.id,
            (parsed.data.content ?? "") + " " + (parsed.data.title ?? ""),
            author.username,
            parsed.data.authorId,
            siteUrl,
          ).catch((err) => logger.error({ err }, "post-mention: failed")),
        ),
      );
    }
  }
});

router.patch("/posts/:id", async (req, res): Promise<void> => {
  const params = UpdatePostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(postsTable)
    .set(parsed.data)
    .where(eq(postsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const enriched = await getEnrichedPost(updated.id);
  res.json(enriched);
});

router.delete("/posts/:id", async (req, res): Promise<void> => {
  const params = DeletePostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(postsTable)
    .where(eq(postsTable.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/posts/:id/like", async (req, res): Promise<void> => {
  const params = LikePostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [updated] = await db
    .update(postsTable)
    .set({ likes: sql`${postsTable.likes} + 1` })
    .where(eq(postsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const enriched = await getEnrichedPost(updated.id);
  res.json(enriched);
});

export default router;
