import { db, newsletterSubscribersTable, productsTable, emailLogTable } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/email";
import { newArrivalTemplate } from "../lib/email-templates";
import { getSiteUrl } from "../lib/config";
import { openai } from "@workspace/integrations-openai-ai-server";

async function generateArrivalCopy(product: {
  name: string;
  brand: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  categorySlug: string;
}): Promise<{ bodyHtml: string; bodyText: string }> {
  if (!openai) {
    const fallback = `${product.name} by ${product.brand} is now in the CloudVape shop. ${product.shortDescription}`;
    return { bodyHtml: `<p>${fallback}</p>`, bodyText: fallback };
  }

  const prompt = `You are the CloudVape store editor writing a short new arrival announcement email (2 short paragraphs, max 150 words total). Write in a genuine, enthusiastic but not salesy tone using British English. The product is:

- Name: ${product.name}
- Brand: ${product.brand}
- Category: ${product.categorySlug}
- Description: ${product.shortDescription}. ${product.description}
- Price: £${(product.priceCents / 100).toFixed(2)}

Return JSON with:
- "html": body HTML (just <p> tags, no wrapper, no heading — the product name and price are already in the template)
- "text": plain text version`;

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
      bodyHtml: typeof parsed.html === "string" ? parsed.html : `<p>${product.shortDescription}</p>`,
      bodyText: typeof parsed.text === "string" ? parsed.text : product.shortDescription,
    };
  } catch {
    return {
      bodyHtml: `<p>${product.shortDescription}</p>`,
      bodyText: product.shortDescription,
    };
  }
}

export async function announceNewProduct(productId: number): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [existingToday] = await db
    .select({ id: emailLogTable.id })
    .from(emailLogTable)
    .where(and(eq(emailLogTable.template, "new-arrival"), gte(emailLogTable.createdAt, todayStart)))
    .limit(1);

  if (existingToday) {
    logger.info({ productId }, "new-arrivals: global daily cap reached, skipping");
    return;
  }

  const rows = await db
    .select({ product: productsTable })
    .from(productsTable)
    .where(eq(productsTable.id, productId));

  if (!rows[0]) return;
  const { product } = rows[0];
  if (!product.inStock) return;

  const subscribers = await db
    .select()
    .from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.status, "confirmed"));

  if (subscribers.length === 0) {
    logger.info({ productId }, "new-arrivals: no subscribers, skipping");
    return;
  }

  const siteUrl = await getSiteUrl();
  const productUrl = `${siteUrl}/shop/p/${product.slug}`;

  const { bodyHtml, bodyText } = await generateArrivalCopy({
    name: product.name,
    brand: product.brand ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    priceCents: product.priceCents,
    categorySlug: "",
  });

  let sent = 0;
  for (const sub of subscribers) {
    try {
      const unsubscribeUrl = `${siteUrl}/newsletter/unsubscribe?token=${sub.token}`;
      const tpl = newArrivalTemplate({
        productName: product.name,
        brand: product.brand ?? "",
        aiBodyHtml: bodyHtml,
        aiBodyText: bodyText,
        priceCents: product.priceCents,
        productUrl,
        unsubscribeUrl,
        siteUrl,
      });
      await sendEmail({ ...tpl, to: sub.email, template: "new-arrival", marketing: true });
      sent++;
    } catch (err) {
      logger.error({ err, email: sub.email }, "new-arrivals: send failed");
    }
  }

  logger.info({ productId, sent }, "new-arrivals: announcement sent");
}
