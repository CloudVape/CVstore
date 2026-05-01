import { db, postsTable, categoriesTable, newsletterSubscribersTable, emailLogTable } from "@workspace/db";
import { desc, gte, sql, eq, count, and, lte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/email";
import { weeklyDigestTemplate } from "../lib/email-templates";
import { getSiteUrl } from "../lib/config";
import { openai } from "@workspace/integrations-openai-ai-server";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function isMonday(date: Date): boolean {
  return date.getDay() === 1;
}

/** Returns the Monday 00:00:00 UTC for the ISO week containing `date`. */
function isoWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

/** Returns the Sunday 23:59:59.999 UTC for the ISO week containing `date`. */
function isoWeekEnd(date: Date): Date {
  const start = isoWeekStart(date);
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
}

/**
 * Checks the email_log table to see if a weekly-digest was already sent
 * during the current ISO week. Avoids duplicate sends after a service restart.
 */
async function wasDigestSentThisWeek(): Promise<boolean> {
  const now = new Date();
  const [row] = await db
    .select({ id: emailLogTable.id })
    .from(emailLogTable)
    .where(
      and(
        eq(emailLogTable.template, "weekly-digest"),
        gte(emailLogTable.createdAt, isoWeekStart(now)),
        lte(emailLogTable.createdAt, isoWeekEnd(now)),
      ),
    )
    .limit(1);
  return !!row;
}

async function getTopPosts(sinceDate: Date, siteUrl: string): Promise<
  Array<{ title: string; url: string; category: string; snippet: string }>
> {
  const rows = await db
    .select({
      post: postsTable,
      categoryName: categoriesTable.name,
    })
    .from(postsTable)
    .leftJoin(categoriesTable, eq(postsTable.categoryId, categoriesTable.id))
    .where(gte(postsTable.createdAt, sinceDate))
    .orderBy(desc(sql`${postsTable.likes} + ${postsTable.commentCount} * 2`))
    .limit(5);

  return rows.map(({ post, categoryName }) => ({
    title: post.title,
    url: `${siteUrl}/forum/${post.id}`,
    category: categoryName ?? "General",
    snippet: post.content.slice(0, 120) + (post.content.length > 120 ? "…" : ""),
  }));
}

async function getNewReviews(sinceDate: Date, siteUrl: string): Promise<
  Array<{ title: string; url: string; snippet: string }>
> {
  const rows = await db
    .select({
      post: postsTable,
    })
    .from(postsTable)
    .innerJoin(categoriesTable, eq(postsTable.categoryId, categoriesTable.id))
    .where(
      sql`${postsTable.createdAt} >= ${sinceDate} AND LOWER(${categoriesTable.name}) LIKE '%review%'`,
    )
    .orderBy(desc(sql`${postsTable.likes} + ${postsTable.commentCount} * 2`))
    .limit(3);

  return rows.map(({ post }) => ({
    title: post.title,
    url: `${siteUrl}/forum/${post.id}`,
    snippet: post.content.slice(0, 100) + (post.content.length > 100 ? "…" : ""),
  }));
}

async function getTrendingCategories(sinceDate: Date, siteUrl: string): Promise<
  Array<{ name: string; url: string; postCount: number }>
> {
  const rows = await db
    .select({
      categoryId: postsTable.categoryId,
      categoryName: categoriesTable.name,
      postCount: count(postsTable.id),
    })
    .from(postsTable)
    .innerJoin(categoriesTable, eq(postsTable.categoryId, categoriesTable.id))
    .where(gte(postsTable.createdAt, sinceDate))
    .groupBy(postsTable.categoryId, categoriesTable.name)
    .orderBy(desc(count(postsTable.id)))
    .limit(3);

  return rows.map((r) => ({
    name: r.categoryName ?? "General",
    url: `${siteUrl}/categories`,
    postCount: r.postCount,
  }));
}

async function generateDigestIntro(topPosts: Array<{ title: string; category: string }>): Promise<{
  html: string;
  text: string;
}> {
  if (!openai || topPosts.length === 0) {
    const fallback =
      "Here's a roundup of the most active posts in the CloudVape community this week. Catch up on what your fellow vapers have been talking about.";
    return { html: `<p>${fallback}</p>`, text: fallback };
  }

  const postList = topPosts.map((p) => `- ${p.title} (${p.category})`).join("\n");
  const prompt = `You are the CloudVape community editor writing a short weekly digest intro (1-2 sentences, max 60 words). British English. Mention the theme of this week's top posts without being repetitive or generic. Posts this week:\n${postList}\n\nReturn JSON with "html" (a <p> tag) and "text" (plain text).`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 256,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const raw = (response.choices[0]?.message?.content ?? "").trim();
    const parsed = JSON.parse(raw) as { html?: string; text?: string };
    return {
      html: typeof parsed.html === "string" ? parsed.html : `<p>${postList}</p>`,
      text: typeof parsed.text === "string" ? parsed.text : postList,
    };
  } catch {
    const fallback = "Here's what the CloudVape community has been talking about this week.";
    return { html: `<p>${fallback}</p>`, text: fallback };
  }
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "there";
}

export async function sendWeeklyDigest(): Promise<{ sent: number }> {
  const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const siteUrl = await getSiteUrl();
  const [topPosts, trendingCategories, newReviews] = await Promise.all([
    getTopPosts(sinceDate, siteUrl),
    getTrendingCategories(sinceDate, siteUrl),
    getNewReviews(sinceDate, siteUrl),
  ]);

  if (topPosts.length === 0) {
    logger.info("weekly-digest: no posts this week, skipping");
    return { sent: 0 };
  }

  const { html: aiIntroHtml, text: aiIntroText } = await generateDigestIntro(topPosts);

  const subscribers = await db
    .select()
    .from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.status, "confirmed"));

  if (subscribers.length === 0) {
    logger.info("weekly-digest: no subscribers");
    return { sent: 0 };
  }

  let sent = 0;
  for (const sub of subscribers) {
    try {
      const unsubscribeUrl = `${siteUrl}/newsletter/unsubscribe?token=${sub.token}`;
      const subscriberName = nameFromEmail(sub.email);
      const tpl = weeklyDigestTemplate({
        posts: topPosts,
        trendingCategories,
        newReviews,
        aiIntroHtml,
        aiIntroText,
        subscriberName,
        unsubscribeUrl,
        siteUrl,
      });
      await sendEmail({ ...tpl, to: sub.email, template: "weekly-digest", marketing: true });
      sent++;
    } catch (err) {
      logger.error({ err, email: sub.email }, "weekly-digest: send failed");
    }
  }

  logger.info({ sent }, "weekly-digest: sent");
  return { sent };
}

export function startWeeklyDigestJob(): void {
  logger.info("weekly-digest: job started");

  async function tick() {
    try {
      const now = new Date();
      if (isMonday(now) && now.getUTCHours() >= 8) {
        const alreadySent = await wasDigestSentThisWeek();
        if (!alreadySent) {
          await sendWeeklyDigest();
        }
      }
    } catch (err) {
      logger.error({ err }, "weekly-digest: tick error");
    }
    setTimeout(tick, CHECK_INTERVAL_MS);
  }

  setTimeout(tick, 15 * 60 * 1000);
}
