import { db, usersTable, ordersTable, postsTable, categoriesTable } from "@workspace/db";
import { and, desc, eq, isNotNull, lt, lte, or, isNull, sql, gte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/email";
import { winBackTemplate } from "../lib/email-templates";
import { getSiteUrl } from "../lib/config";
import { openai } from "@workspace/integrations-openai-ai-server";

const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const LAPSED_DAYS = 30;
const COOLDOWN_DAYS = 60;

async function getTopRecentPosts(siteUrl: string): Promise<Array<{ title: string; url: string }>> {
  const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: postsTable.id, title: postsTable.title })
    .from(postsTable)
    .where(gte(postsTable.createdAt, sinceDate))
    .orderBy(desc(sql`${postsTable.likes} + ${postsTable.commentCount} * 2`))
    .limit(3);
  return rows.map((r) => ({ title: r.title, url: `${siteUrl}/forum/post/${r.id}` }));
}

async function generateWinBackCopy(opts: {
  username: string;
  purchaseHistory: string[];
  recentPostTitles: string[];
}): Promise<{ html: string; text: string }> {
  if (!openai) {
    const fallback = `Hi ${opts.username}, it's been a while since we've seen you on CloudVape. The community has been busy — come catch up!`;
    return { html: `<p>${fallback}</p>`, text: fallback };
  }

  const prompt = `You are writing a warm, genuine win-back email for CloudVape, a UK vaping community and shop. Be friendly and personal, not salesy. Use British English. Max 80 words (2 short paragraphs).

User: ${opts.username}
Past purchases: ${opts.purchaseHistory.slice(0, 3).join(", ") || "a few items"}
Recent community highlights: ${opts.recentPostTitles.join(", ") || "lots of new discussions"}

Return JSON with "html" (2 <p> tags, no greeting — starts with the first paragraph) and "text" (plain text, also no greeting).`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 512,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const raw = (response.choices[0]?.message?.content ?? "").trim();
    const parsed = JSON.parse(raw) as { html?: string; text?: string };
    return {
      html: typeof parsed.html === "string" ? parsed.html : `<p>It's been a while! Come see what's new at CloudVape.</p>`,
      text: typeof parsed.text === "string" ? parsed.text : `It's been a while! Come see what's new at CloudVape.`,
    };
  } catch {
    const fallback = `It's been a while! The CloudVape community has been busy — come see what's new.`;
    return { html: `<p>${fallback}</p>`, text: fallback };
  }
}

async function runWinBack(): Promise<void> {
  const lapsedCutoff = new Date(Date.now() - LAPSED_DAYS * 24 * 60 * 60 * 1000);
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const lapsedUsers = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.isAiPersona, false),
        eq(usersTable.notificationsEnabled, true),
        lte(usersTable.lastVisitedAt, lapsedCutoff),
        isNotNull(usersTable.lastVisitedAt),
        or(isNull(usersTable.winBackSentAt), lte(usersTable.winBackSentAt, cooldownCutoff)),
      ),
    )
    .limit(50);

  if (lapsedUsers.length === 0) {
    logger.debug("win-back: no lapsed users");
    return;
  }

  const siteUrl = await getSiteUrl();
  const recentPosts = await getTopRecentPosts(siteUrl);
  const recentPostTitles = recentPosts.map((p) => p.title);

  for (const user of lapsedUsers) {
    try {
      const userOrders = await db
        .select({ items: ordersTable.items })
        .from(ordersTable)
        .where(eq(ordersTable.email, user.email))
        .limit(3);

      if (userOrders.length === 0) continue;

      const purchaseHistory = userOrders
        .flatMap((o) => {
          const items = o.items as Array<{ name: string }>;
          return items.map((i) => i.name);
        })
        .slice(0, 3);

      const { html, text } = await generateWinBackCopy({
        username: user.username,
        purchaseHistory,
        recentPostTitles,
      });

      const unsubscribeUrl = `${siteUrl}/newsletter/unsubscribe?token=${user.id}`;
      const tpl = winBackTemplate({
        username: user.username,
        aiBodyHtml: html,
        aiBodyText: text,
        recentPosts,
        siteUrl,
        unsubscribeUrl,
      });

      await sendEmail({ ...tpl, to: user.email, template: "win-back", marketing: true });
      await db
        .update(usersTable)
        .set({ winBackSentAt: new Date() })
        .where(eq(usersTable.id, user.id));

      logger.info({ userId: user.id }, "win-back: email sent");
    } catch (err) {
      logger.error({ err, userId: user.id }, "win-back: failed for user");
    }
  }
}

export function startWinBackJob(): void {
  logger.info("win-back: job started");

  async function tick() {
    try {
      await runWinBack();
    } catch (err) {
      logger.error({ err }, "win-back: tick error");
    }
    setTimeout(tick, CHECK_INTERVAL_MS);
  }

  setTimeout(tick, 20 * 60 * 1000);
}
