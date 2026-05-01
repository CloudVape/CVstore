import { Router, type IRouter } from "express";
import { eq, asc, sql, ne, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, commentsTable, usersTable, postsTable } from "@workspace/db";
import {
  ListCommentsParams,
  CreateCommentParams,
  CreateCommentBody,
} from "@workspace/api-zod";
import { sendEmail, fireAndForget } from "../lib/email";
import {
  forumReplyNotificationTemplate,
  mentionNotificationTemplate,
  threadParticipantNotificationTemplate,
} from "../lib/email-templates";
import { getSiteUrl } from "../lib/config";
import { logger } from "../lib/logger";

const MAX_MENTIONS_PER_CONTENT = 5;

const router: IRouter = Router();

const MENTION_RE = /@([a-zA-Z0-9_]+)/g;

function extractMentions(text: string): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m[1]) matches.push(m[1].toLowerCase());
  }
  return [...new Set(matches)].slice(0, MAX_MENTIONS_PER_CONTENT);
}

async function sendReplyNotification(
  post: typeof postsTable.$inferSelect,
  comment: typeof commentsTable.$inferSelect,
  commenter: typeof usersTable.$inferSelect,
  siteUrl: string,
): Promise<void> {
  if (post.authorId === comment.authorId) return;

  const [postAuthor] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, post.authorId));

  if (!postAuthor || !postAuthor.notificationsEnabled || postAuthor.isAiPersona) return;

  const postUrl = `${siteUrl}/forum/${post.id}`;
  const notificationsUrl = `${siteUrl}/settings`;
  const snippet = comment.content.slice(0, 200);

  const tpl = forumReplyNotificationTemplate({
    username: postAuthor.username,
    postTitle: post.title,
    postUrl,
    replierUsername: commenter.username,
    replySnippet: snippet,
    notificationsUrl,
    siteUrl,
  });

  await sendEmail({ ...tpl, to: postAuthor.email, template: "forum-reply" });
}

async function sendMentionNotifications(
  content: string,
  contextUrl: string,
  mentionerUsername: string,
  mentionerUserId: number,
  siteUrl: string,
): Promise<void> {
  const handles = extractMentions(content);
  if (handles.length === 0) return;

  for (const handle of handles) {
    const [mentioned] = await db
      .select()
      .from(usersTable)
      .where(sql`LOWER(${usersTable.username}) = ${handle}`);

    if (
      !mentioned ||
      mentioned.id === mentionerUserId ||
      !mentioned.notificationsEnabled ||
      mentioned.isAiPersona
    ) {
      continue;
    }

    const notificationsUrl = `${siteUrl}/settings`;
    const snippet = content.slice(0, 300);
    const tpl = mentionNotificationTemplate({
      username: mentioned.username,
      mentionerUsername,
      context: snippet,
      contextUrl,
      notificationsUrl,
      siteUrl,
    });

    await sendEmail({ ...tpl, to: mentioned.email, template: "mention" });
  }
}

async function sendThreadParticipantNotifications(
  post: typeof postsTable.$inferSelect,
  comment: typeof commentsTable.$inferSelect,
  commenter: typeof usersTable.$inferSelect,
  siteUrl: string,
): Promise<void> {
  const commenters = await db
    .select({ userId: commentsTable.authorId })
    .from(commentsTable)
    .where(
      and(
        eq(commentsTable.postId, post.id),
        ne(commentsTable.id, comment.id),
        ne(commentsTable.authorId, commenter.id),
        ne(commentsTable.authorId, post.authorId),
      ),
    );

  const uniqueIds = [...new Set(commenters.map((c) => c.userId))];
  for (const participantId of uniqueIds) {
    const [participant] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, participantId));
    if (!participant || !participant.notificationsEnabled || participant.isAiPersona) continue;

    const postUrl = `${siteUrl}/forum/${post.id}`;
    const tpl = threadParticipantNotificationTemplate({
      username: participant.username,
      postTitle: post.title,
      postUrl,
      commenterUsername: commenter.username,
      replySnippet: comment.content.slice(0, 200),
      notificationsUrl: `${siteUrl}/settings`,
      siteUrl,
    });
    await sendEmail({ ...tpl, to: participant.email, template: "forum-reply" });
  }
}

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
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

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

  const [sessionUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId));
  if (!sessionUser) {
    res.status(403).json({ error: "User profile not found" });
    return;
  }

  const authorId = sessionUser.id;

  const [comment] = await db
    .insert(commentsTable)
    .values({
      postId: pathParams.data.postId,
      authorId,
      content: parsed.data.content,
      isAiGenerated: false,
    })
    .returning();

  await db
    .update(postsTable)
    .set({ commentCount: sql`${postsTable.commentCount} + 1` })
    .where(eq(postsTable.id, pathParams.data.postId));

  const [post] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, comment.postId));

  res.status(201).json({
    ...comment,
    authorName: sessionUser.username,
    authorAvatarUrl: sessionUser.avatarUrl ?? null,
  });

  if (post) {
    fireAndForget(
      getSiteUrl().then(async (siteUrl) => {
        const postUrl = `${siteUrl}/forum/${post.id}`;
        await sendReplyNotification(post, comment, sessionUser, siteUrl).catch((err) =>
          logger.error({ err }, "reply-notification: failed"),
        );
        await sendMentionNotifications(
          comment.content,
          postUrl,
          sessionUser.username,
          sessionUser.id,
          siteUrl,
        ).catch((err) => logger.error({ err }, "mention-notification: failed"));
        await sendThreadParticipantNotifications(post, comment, sessionUser, siteUrl).catch((err) =>
          logger.error({ err }, "thread-participant-notification: failed"),
        );
      }),
    );
  }
});

export default router;
