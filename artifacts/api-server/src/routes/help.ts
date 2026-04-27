import { Router, type IRouter } from "express";
import { eq, and, ilike, or } from "drizzle-orm";
import { db, helpCategoriesTable, helpArticlesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/help/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select()
    .from(helpCategoriesTable)
    .orderBy(helpCategoriesTable.sortOrder, helpCategoriesTable.name);
  res.json(categories);
});

router.get("/help/articles", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const categorySlug = typeof req.query.category === "string" ? req.query.category : "";

  if (q) {
    const articles = await db
      .select({
        id: helpArticlesTable.id,
        slug: helpArticlesTable.slug,
        title: helpArticlesTable.title,
        body: helpArticlesTable.body,
        categoryId: helpArticlesTable.categoryId,
        sortOrder: helpArticlesTable.sortOrder,
        published: helpArticlesTable.published,
        createdAt: helpArticlesTable.createdAt,
        updatedAt: helpArticlesTable.updatedAt,
        categorySlug: helpCategoriesTable.slug,
        categoryName: helpCategoriesTable.name,
      })
      .from(helpArticlesTable)
      .innerJoin(helpCategoriesTable, eq(helpArticlesTable.categoryId, helpCategoriesTable.id))
      .where(
        and(
          eq(helpArticlesTable.published, true),
          or(
            ilike(helpArticlesTable.title, `%${q}%`),
            ilike(helpArticlesTable.body, `%${q}%`)
          )
        )
      )
      .orderBy(helpArticlesTable.sortOrder, helpArticlesTable.title);
    res.json(articles);
    return;
  }

  const whereClause = categorySlug
    ? and(eq(helpArticlesTable.published, true), eq(helpCategoriesTable.slug, categorySlug))
    : eq(helpArticlesTable.published, true);

  const articles = await db
    .select({
      id: helpArticlesTable.id,
      slug: helpArticlesTable.slug,
      title: helpArticlesTable.title,
      body: helpArticlesTable.body,
      categoryId: helpArticlesTable.categoryId,
      sortOrder: helpArticlesTable.sortOrder,
      published: helpArticlesTable.published,
      createdAt: helpArticlesTable.createdAt,
      updatedAt: helpArticlesTable.updatedAt,
      categorySlug: helpCategoriesTable.slug,
      categoryName: helpCategoriesTable.name,
    })
    .from(helpArticlesTable)
    .innerJoin(helpCategoriesTable, eq(helpArticlesTable.categoryId, helpCategoriesTable.id))
    .where(whereClause)
    .orderBy(helpCategoriesTable.sortOrder, helpArticlesTable.sortOrder, helpArticlesTable.title);
  res.json(articles);
});

router.get("/help/articles/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const [article] = await db
    .select({
      id: helpArticlesTable.id,
      slug: helpArticlesTable.slug,
      title: helpArticlesTable.title,
      body: helpArticlesTable.body,
      categoryId: helpArticlesTable.categoryId,
      sortOrder: helpArticlesTable.sortOrder,
      published: helpArticlesTable.published,
      createdAt: helpArticlesTable.createdAt,
      updatedAt: helpArticlesTable.updatedAt,
      categorySlug: helpCategoriesTable.slug,
      categoryName: helpCategoriesTable.name,
    })
    .from(helpArticlesTable)
    .innerJoin(helpCategoriesTable, eq(helpArticlesTable.categoryId, helpCategoriesTable.id))
    .where(and(eq(helpArticlesTable.slug, slug), eq(helpArticlesTable.published, true)));

  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  res.json(article);
});

export default router;
