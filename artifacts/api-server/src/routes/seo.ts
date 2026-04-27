import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import {
  db,
  productsTable,
  productCategoriesTable,
  postsTable,
} from "@workspace/db";

const router: IRouter = Router();

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function originFromRequest(req: import("express").Request): string {
  const env = process.env["SITE_URL"];
  if (env) return env.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "";
  return `${proto}://${host}`;
}

function urlEntry(loc: string, lastmod?: Date | string | null, changefreq?: string, priority?: string) {
  const last = lastmod
    ? new Date(lastmod).toISOString()
    : new Date().toISOString();
  return [
    "<url>",
    `<loc>${escapeXml(loc)}</loc>`,
    `<lastmod>${last}</lastmod>`,
    changefreq ? `<changefreq>${changefreq}</changefreq>` : "",
    priority ? `<priority>${priority}</priority>` : "",
    "</url>",
  ]
    .filter(Boolean)
    .join("");
}

router.get("/sitemap.xml", async (req, res): Promise<void> => {
  try {
    const origin = originFromRequest(req);

    const [products, categories, posts] = await Promise.all([
      db
        .select({
          slug: productsTable.slug,
          updatedAt: productsTable.updatedAt,
        })
        .from(productsTable)
        .orderBy(desc(productsTable.updatedAt))
        .limit(5000),
      db
        .select({
          slug: productCategoriesTable.slug,
        })
        .from(productCategoriesTable)
        .limit(500),
      db
        .select({
          id: postsTable.id,
          updatedAt: postsTable.updatedAt,
        })
        .from(postsTable)
        .orderBy(desc(postsTable.updatedAt))
        .limit(5000),
    ]);

    const now = new Date();
    const staticPages: Array<[string, string, string]> = [
      ["/", "daily", "1.0"],
      ["/shop", "daily", "0.9"],
      ["/shop/categories", "weekly", "0.8"],
      ["/shop?filter=new", "daily", "0.7"],
      ["/shop?filter=bestsellers", "daily", "0.7"],
      ["/shop?filter=featured", "weekly", "0.7"],
      ["/forum", "daily", "0.6"],
      ["/categories", "weekly", "0.5"],
    ];

    const urls: string[] = [];
    for (const [path, freq, prio] of staticPages) {
      urls.push(urlEntry(`${origin}${path}`, now, freq, prio));
    }
    for (const c of categories) {
      urls.push(urlEntry(`${origin}/shop/c/${c.slug}`, now, "weekly", "0.7"));
    }
    for (const p of products) {
      urls.push(urlEntry(`${origin}/shop/p/${p.slug}`, p.updatedAt, "weekly", "0.8"));
    }
    for (const p of posts) {
      urls.push(urlEntry(`${origin}/forum/${p.id}`, p.updatedAt, "weekly", "0.4"));
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join(
      "\n",
    )}\n</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=3600");
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).send("Failed to build sitemap");
  }
});

router.get("/robots.txt", (req, res): void => {
  const origin = originFromRequest(req);
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /order/",
    "Disallow: /login",
    "Disallow: /join",
    "Disallow: /profile/",
    "Disallow: /forum/new",
    "Disallow: /api/",
    "",
    `Sitemap: ${origin}/api/sitemap.xml`,
    "",
  ].join("\n");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(body);
});

export default router;
