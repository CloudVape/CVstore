import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, wishlistTable, productsTable, productCategoriesTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { usersTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

router.get("/wishlist", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId));

  if (!user) {
    res.status(404).json({ error: "User profile not found" });
    return;
  }

  const rows = await db
    .select({
      wishlist: wishlistTable,
      product: productsTable,
      categorySlug: productCategoriesTable.slug,
      categoryName: productCategoriesTable.name,
    })
    .from(wishlistTable)
    .innerJoin(productsTable, eq(wishlistTable.productId, productsTable.id))
    .leftJoin(productCategoriesTable, eq(productsTable.categoryId, productCategoriesTable.id))
    .where(eq(wishlistTable.userId, user.id));

  res.json(
    rows.map(({ wishlist, product, categorySlug, categoryName }) => ({
      ...product,
      categorySlug,
      categoryName,
      addedAt: wishlist.addedAt,
    }))
  );
});

const AddWishlistBody = z.object({ productId: z.number().int().positive() });

router.post("/wishlist", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = AddWishlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "productId is required" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId));

  if (!user) {
    res.status(404).json({ error: "User profile not found" });
    return;
  }

  const [product] = await db
    .select({ id: productsTable.id, priceCents: productsTable.priceCents })
    .from(productsTable)
    .where(eq(productsTable.id, parsed.data.productId));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  await db
    .insert(wishlistTable)
    .values({
      userId: user.id,
      productId: product.id,
      lastNotifiedPriceCents: product.priceCents,
    })
    .onConflictDoNothing();

  res.status(201).json({ message: "Added to wishlist" });
});

router.delete("/wishlist/:productId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const productId = parseInt(req.params.productId, 10);
  if (isNaN(productId)) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId));

  if (!user) {
    res.status(404).json({ error: "User profile not found" });
    return;
  }

  await db
    .delete(wishlistTable)
    .where(and(eq(wishlistTable.userId, user.id), eq(wishlistTable.productId, productId)));

  res.sendStatus(204);
});

export default router;
