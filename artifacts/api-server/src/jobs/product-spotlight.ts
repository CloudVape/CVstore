import {
  db,
  postsTable,
  usersTable,
  categoriesTable,
  productsTable,
  productCategoriesTable,
} from "@workspace/db";
import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { openai } from "@workspace/integrations-openai-ai-server";

const SOURCE_PREFIX = "ai-spotlight:";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const PRODUCT_CATEGORY_TO_FORUM: Record<string, string> = {
  "e-liquids": "e-liquid-talk",
  mods: "hardware-reviews",
  pods: "hardware-reviews",
  tanks: "hardware-reviews",
  coils: "diy-coil-building",
  disposables: "hardware-reviews",
  accessories: "industry-news",
};
const FALLBACK_FORUM_SLUG = "industry-news";

async function getForumCategoryId(slug: string): Promise<number | null> {
  const rows = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, slug))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function getPersonaIds(): Promise<number[]> {
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.isAiPersona, true))
    .orderBy(usersTable.id);
  return rows.map((r) => r.id);
}

async function getSpottedProductIds(): Promise<number[]> {
  const rows = await db
    .select({ sourceUrl: postsTable.sourceUrl })
    .from(postsTable)
    .where(sql`${postsTable.sourceUrl} LIKE ${SOURCE_PREFIX + "%"}`);
  return rows
    .map((r) => {
      const raw = r.sourceUrl?.slice(SOURCE_PREFIX.length);
      return raw ? parseInt(raw, 10) : NaN;
    })
    .filter((n) => !isNaN(n));
}

async function getLastSpotlightDate(): Promise<Date | null> {
  const rows = await db
    .select({ createdAt: postsTable.createdAt })
    .from(postsTable)
    .where(sql`${postsTable.sourceUrl} LIKE ${SOURCE_PREFIX + "%"}`)
    .orderBy(desc(postsTable.createdAt))
    .limit(1);
  return rows[0]?.createdAt ?? null;
}

async function pickNextProduct(excludeIds: number[]) {
  const query = db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      slug: productsTable.slug,
      brand: productsTable.brand,
      shortDescription: productsTable.shortDescription,
      description: productsTable.description,
      priceCents: productsTable.priceCents,
      flavor: productsTable.flavor,
      nicotineStrength: productsTable.nicotineStrength,
      tags: productsTable.tags,
      categorySlug: productCategoriesTable.slug,
    })
    .from(productsTable)
    .innerJoin(
      productCategoriesTable,
      eq(productsTable.categoryId, productCategoriesTable.id),
    )
    .where(
      and(
        eq(productsTable.inStock, true),
        excludeIds.length > 0
          ? notInArray(productsTable.id, excludeIds)
          : undefined,
      ),
    )
    .orderBy(sql`RANDOM()`)
    .limit(1);

  const rows = await query;
  return rows[0] ?? null;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function generateSpotlightContent(product: {
  name: string;
  brand: string;
  shortDescription: string;
  description: string;
  flavor: string | null;
  nicotineStrength: string | null;
  priceCents: number;
  categorySlug: string;
  tags: string[];
}): Promise<{ title: string; content: string }> {
  const extras: string[] = [];
  if (product.flavor) extras.push(`Flavour: ${product.flavor}`);
  if (product.nicotineStrength) extras.push(`Nicotine: ${product.nicotineStrength}`);

  const prompt = `You are a genuine vaping community member writing an enthusiastic but honest post on a vaping forum about a product you picked up from an online vape store called CloudVape.

Product details:
- Name: ${product.name}
- Brand: ${product.brand}
- Category: ${product.categorySlug}
- Short description: ${product.shortDescription}
- Full description: ${product.description}
${extras.length > 0 ? extras.join("\n") : ""}
- Price: ${formatPrice(product.priceCents)}
- Tags: ${product.tags.join(", ")}

Write a forum post (2-4 short paragraphs) sharing your experience or enthusiasm for this product. Sound natural and conversational — like a real community member, not a salesperson. Mention specific details from the product description. DO NOT use marketing buzzwords like "game-changer". Use British English spelling where appropriate (e.g. flavour, colour). End the post with a direct link to the store listing using this exact Markdown: [Check it out on CloudVape](/shop/p/${product.categorySlug})

Return a JSON object with two fields:
- "title": a short, engaging forum post title (under 80 characters)
- "content": the post body in Markdown`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const raw = (response.choices[0]?.message?.content ?? "").trim();
  let parsed: { title?: string; content?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    const titleMatch = raw.match(/"title"\s*:\s*"([^"]+)"/);
    const contentMatch = raw.match(/"content"\s*:\s*"([\s\S]+?)"\s*[,}]/);
    if (titleMatch) parsed.title = titleMatch[1];
    if (contentMatch) parsed.content = contentMatch[1]?.replace(/\\n/g, "\n");
  }

  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : `${product.name} — picked this up from CloudVape`;

  const content =
    typeof parsed.content === "string" && parsed.content.trim()
      ? parsed.content.trim()
      : `Just grabbed the ${product.name} from CloudVape. Really impressed so far — ${product.shortDescription.toLowerCase()}.\n\n[Check it out on CloudVape](/shop/p/${product.categorySlug})`;

  return { title, content };
}

async function ensureWeeklySpotlight(): Promise<void> {
  const last = await getLastSpotlightDate();
  const now = new Date();

  if (last && now.getTime() - last.getTime() < WEEK_MS) {
    return;
  }

  const personas = await getPersonaIds();
  if (personas.length === 0) {
    logger.warn("product-spotlight: no AI personas found — job idle");
    return;
  }

  const spotted = await getSpottedProductIds();
  const product = await pickNextProduct(spotted);

  if (!product) {
    if (spotted.length > 0) {
      logger.info(
        "product-spotlight: all products spotlighted — resetting cycle",
      );
      const firstProduct = await pickNextProduct([]);
      if (!firstProduct) {
        logger.warn("product-spotlight: no products in DB — job idle");
        return;
      }
      await runSpotlight(firstProduct, personas, now);
    } else {
      logger.warn("product-spotlight: no in-stock products found — job idle");
    }
    return;
  }

  await runSpotlight(product, personas, now);
}

async function runSpotlight(
  product: {
    id: number;
    name: string;
    slug: string;
    brand: string;
    shortDescription: string;
    description: string;
    priceCents: number;
    flavor: string | null;
    nicotineStrength: string | null;
    tags: string[];
    categorySlug: string;
  },
  personas: number[],
  now: Date,
): Promise<void> {
  const forumSlug =
    PRODUCT_CATEGORY_TO_FORUM[product.categorySlug] ?? FALLBACK_FORUM_SLUG;
  const forumCategoryId = await getForumCategoryId(forumSlug);

  if (!forumCategoryId) {
    logger.warn(
      { forumSlug },
      "product-spotlight: forum category not found — job idle",
    );
    return;
  }

  let title: string;
  let content: string;

  try {
    const generated = await generateSpotlightContent(product);
    title = generated.title;
    content = generated.content;
  } catch (err) {
    logger.error(
      { err, productId: product.id },
      "product-spotlight: AI generation failed — skipping this week",
    );
    return;
  }

  const authorId = personas[now.getDay() % personas.length]!;

  try {
    await db.insert(postsTable).values({
      title,
      content,
      categoryId: forumCategoryId,
      authorId,
      isAiGenerated: true,
      tags: product.tags.slice(0, 5),
      sourceUrl: SOURCE_PREFIX + product.id,
      createdAt: now,
      updatedAt: now,
    });
    await db
      .update(usersTable)
      .set({ postCount: sql`${usersTable.postCount} + 1` })
      .where(eq(usersTable.id, authorId));
    await db
      .update(categoriesTable)
      .set({ postCount: sql`${categoriesTable.postCount} + 1` })
      .where(eq(categoriesTable.id, forumCategoryId));

    logger.info(
      { productId: product.id, name: product.name, forumSlug },
      "product-spotlight: weekly spotlight post created",
    );
  } catch (err) {
    logger.error(
      { err, productId: product.id },
      "product-spotlight: failed to insert spotlight post",
    );
  }
}

export function startProductSpotlightJob(): void {
  ensureWeeklySpotlight().catch((err) => {
    logger.error({ err }, "product-spotlight: initial check failed");
  });

  setInterval(() => {
    ensureWeeklySpotlight().catch((err) => {
      logger.error({ err }, "product-spotlight: hourly check failed");
    });
  }, CHECK_INTERVAL_MS).unref();
}
