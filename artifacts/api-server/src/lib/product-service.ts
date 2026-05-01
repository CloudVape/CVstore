import { db, productsTable } from "@workspace/db";
import { fireAndForget } from "./email";
import { announceNewProduct } from "../jobs/new-arrivals";
import { logger } from "./logger";

export type InsertProductData = {
  name: string;
  slug: string;
  brand: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  comparePriceCents?: number | null;
  categoryId: number;
  imageUrl: string;
  stockCount?: number;
  inStock: boolean;
  flavor?: string | null;
  nicotineStrength?: string | null;
  vgPgRatio?: string | null;
  bottleSize?: string | null;
  tags?: string[];
  supplierId?: number | null;
  externalSku?: string | null;
  lastSyncedAt?: Date;
};

export async function insertProduct(data: InsertProductData): Promise<{ id: number }> {
  const [inserted] = await db
    .insert(productsTable)
    .values({
      name: data.name,
      slug: data.slug,
      brand: data.brand,
      shortDescription: data.shortDescription,
      description: data.description,
      priceCents: data.priceCents,
      comparePriceCents: data.comparePriceCents ?? null,
      categoryId: data.categoryId,
      imageUrl: data.imageUrl,
      stockCount: data.stockCount ?? 0,
      inStock: data.inStock,
      flavor: data.flavor ?? null,
      nicotineStrength: data.nicotineStrength ?? null,
      vgPgRatio: data.vgPgRatio ?? null,
      bottleSize: data.bottleSize ?? null,
      tags: data.tags ?? [],
      supplierId: data.supplierId ?? null,
      externalSku: data.externalSku ?? null,
      lastSyncedAt: data.lastSyncedAt ?? new Date(),
    })
    .returning({ id: productsTable.id });

  if (!inserted) throw new Error("Product insert returned no rows");

  if (data.inStock) {
    fireAndForget(
      announceNewProduct(inserted.id).catch((err) =>
        logger.error({ err, productId: inserted.id }, "insertProduct: announceNewProduct failed"),
      ),
    );
  }

  return { id: inserted.id };
}
