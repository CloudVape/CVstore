import { Router, type IRouter } from "express";
import { eq, desc, and, or, ilike, sql, type SQL } from "drizzle-orm";
import { db, productsTable, productCategoriesTable } from "@workspace/db";

const router: IRouter = Router();

async function listEnrichedProducts(where?: SQL | undefined, limit = 60, offset = 0) {
  const query = db
    .select({
      product: productsTable,
      categoryName: productCategoriesTable.name,
      categorySlug: productCategoriesTable.slug,
    })
    .from(productsTable)
    .leftJoin(productCategoriesTable, eq(productsTable.categoryId, productCategoriesTable.id))
    .orderBy(desc(productsTable.isBestseller), desc(productsTable.rating))
    .limit(limit)
    .offset(offset);
  const rows = where ? await query.where(where) : await query;
  return rows.map(({ product, categoryName, categorySlug }) => ({
    ...product,
    categoryName,
    categorySlug,
  }));
}

async function getEnrichedProductBySlug(slug: string) {
  const rows = await db
    .select({
      product: productsTable,
      categoryName: productCategoriesTable.name,
      categorySlug: productCategoriesTable.slug,
    })
    .from(productsTable)
    .leftJoin(productCategoriesTable, eq(productsTable.categoryId, productCategoriesTable.id))
    .where(eq(productsTable.slug, slug));
  if (!rows[0]) return null;
  const { product, categoryName, categorySlug } = rows[0];
  return { ...product, categoryName, categorySlug };
}

router.get("/products", async (req, res): Promise<void> => {
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  const categorySlug = typeof req.query.categorySlug === "string" ? req.query.categorySlug : undefined;
  const featured = req.query.featured === "true" ? true : req.query.featured === "false" ? false : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 60;
  const offset = req.query.offset ? Number(req.query.offset) : 0;

  const conditions: SQL[] = [];
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  if (categorySlug) conditions.push(eq(productCategoriesTable.slug, categorySlug));
  if (featured !== undefined) conditions.push(eq(productsTable.isFeatured, featured));
  if (search) {
    const term = `%${search}%`;
    const orCond = or(
      ilike(productsTable.name, term),
      ilike(productsTable.brand, term),
      ilike(productsTable.shortDescription, term)
    );
    if (orCond) conditions.push(orCond);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const products = await listEnrichedProducts(where, limit, offset);
  res.json(products);
});

router.get("/products/featured", async (_req, res): Promise<void> => {
  const products = await listEnrichedProducts(eq(productsTable.isFeatured, true), 12, 0);
  res.json(products);
});

router.get("/products/bestsellers", async (_req, res): Promise<void> => {
  const products = await listEnrichedProducts(eq(productsTable.isBestseller, true), 12, 0);
  res.json(products);
});

router.get("/products/new", async (_req, res): Promise<void> => {
  const products = await listEnrichedProducts(eq(productsTable.isNew, true), 12, 0);
  res.json(products);
});

router.get("/products/:slug", async (req, res): Promise<void> => {
  const product = await getEnrichedProductBySlug(req.params.slug);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(product);
});

export default router;
