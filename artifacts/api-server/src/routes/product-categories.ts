import { Router, type IRouter } from "express";
import { db, productCategoriesTable } from "@workspace/db";
import { asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/product-categories", async (_req, res): Promise<void> => {
  const cats = await db
    .select()
    .from(productCategoriesTable)
    .orderBy(asc(productCategoriesTable.sortOrder), asc(productCategoriesTable.name));
  res.json(cats);
});

export default router;
