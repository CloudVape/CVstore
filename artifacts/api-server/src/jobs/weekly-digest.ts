import { db, postsTable, categoriesTable, newsletterSubscribersTable, usersTable } from "@workspace/db";
import { desc, gte, sql, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/email";
import { weeklyDigestTemplate } from "../lib/email-templates";
import { getSiteUrl } from "../lib/config";
import { openai } from "@workspace/integrations-openai-ai-server";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function isMonday(date: Date): boolean {
  return date.getDay() === 1;
}

function lastDigestSentKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-W${getISOWeek(now)}`;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

let lastSentWeek = "";

async function getTopPosts(sinceDate: Date): Promise<
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
    url: `POST_URL_PLACEHOLDER/${post.id}`,
    category: categoryName ?? "General",
    snippet: post.content.slice(0, 120) + (post.content.length > 120 ? "…" : ""),
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

export async function sendWeeklyDigest(): Promise<{ sent: number }> {
  const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const siteUrl = await getSiteUrl();
  const topPosts = (await getTopPosts(sinceDate)).map((p) => ({
    ...p,
    url: p.url.replace("POST_URL_PLACEHOLDER", `${siteUrl}/forum/post`),
  }));

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
      const tpl = weeklyDigestTemplate({ posts: topPosts, aiIntroHtml, aiIntroText, unsubscribeUrl, siteUrl });
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
      const weekKey = lastDigestSentKey();
      if (isMonday(now) && now.getUTCHours() >= 8 && lastSentWeek !== weekKey) {
        lastSentWeek = weekKey;
        await sendWeeklyDigest();
      }
    } catch (err) {
      logger.error({ err }, "weekly-digest: tick error");
    }
    setTimeout(tick, CHECK_INTERVAL_MS);
  }

  setTimeout(tick, 15 * 60 * 1000);
}
