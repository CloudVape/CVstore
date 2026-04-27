import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Branded placeholder generator — dark studio background with brand text
function placeholderUrl(name: string, brand: string, color = "06b6d4"): string {
  const text = encodeURIComponent(brand.toUpperCase());
  return `https://placehold.co/600x600/0a0a0a/${color}?font=roboto&text=${text}`;
}

// Map products to category-tinted colors
const colorByCategory: Record<string, string> = {
  mods: "06b6d4",       // cyan
  pods: "a855f7",       // purple
  tanks: "f59e0b",      // amber
  "e-liquids": "ec4899",// pink
  coils: "10b981",      // emerald
  disposables: "ef4444",// red
  accessories: "6366f1",// indigo
};

async function fixImages() {
  console.log("Fetching products...");
  const products = await db.select().from(productsTable);
  
  // Get categories to look up slug
  const { productCategoriesTable } = await import("@workspace/db");
  const cats = await db.select().from(productCategoriesTable);
  const catSlugById = Object.fromEntries(cats.map(c => [c.id, c.slug]));
  
  for (const p of products) {
    const slug = catSlugById[p.categoryId] ?? "mods";
    const color = colorByCategory[slug] ?? "06b6d4";
    const newUrl = placeholderUrl(p.name, p.brand, color);
    await db.update(productsTable).set({ imageUrl: newUrl }).where(eq(productsTable.id, p.id));
  }
  console.log(`Updated ${products.length} product images`);
  process.exit(0);
}

fixImages().catch(e => { console.error(e); process.exit(1); });
