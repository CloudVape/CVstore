import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, helpCategoriesTable, helpArticlesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/admin/help/categories", async (_req, res): Promise<void> => {
  const cats = await db.select().from(helpCategoriesTable).orderBy(asc(helpCategoriesTable.sortOrder));
  res.json(cats);
});

router.post("/admin/help/categories", async (req, res): Promise<void> => {
  const Body = z.object({
    slug: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [cat] = await db.insert(helpCategoriesTable).values(parsed.data).returning();
  res.status(201).json(cat);
});

router.put("/admin/help/categories/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const Body = z.object({
    slug: z.string().min(1).max(100).optional(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [cat] = await db.update(helpCategoriesTable).set(parsed.data).where(eq(helpCategoriesTable.id, id)).returning();
  if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(cat);
});

router.delete("/admin/help/categories/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(helpCategoriesTable).where(eq(helpCategoriesTable.id, id));
  res.json({ ok: true });
});

router.get("/admin/help/articles", async (_req, res): Promise<void> => {
  const articles = await db
    .select()
    .from(helpArticlesTable)
    .orderBy(asc(helpArticlesTable.categoryId), asc(helpArticlesTable.sortOrder));
  res.json(articles);
});

router.post("/admin/help/articles", async (req, res): Promise<void> => {
  const Body = z.object({
    categoryId: z.number().int(),
    slug: z.string().min(1).max(200),
    title: z.string().min(1).max(500),
    body: z.string().min(1),
    published: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [article] = await db.insert(helpArticlesTable).values({ ...parsed.data, updatedAt: new Date() }).returning();
  res.status(201).json(article);
});

router.put("/admin/help/articles/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const Body = z.object({
    categoryId: z.number().int().optional(),
    slug: z.string().min(1).max(200).optional(),
    title: z.string().min(1).max(500).optional(),
    body: z.string().min(1).optional(),
    published: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [article] = await db
    .update(helpArticlesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(helpArticlesTable.id, id))
    .returning();
  if (!article) { res.status(404).json({ error: "Article not found" }); return; }
  res.json(article);
});

router.delete("/admin/help/articles/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(helpArticlesTable).where(eq(helpArticlesTable.id, id));
  res.json({ ok: true });
});

export default router;
