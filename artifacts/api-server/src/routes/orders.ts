import { Router, type IRouter } from "express";
import { eq, inArray, sql, desc } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, ordersTable, productsTable, usersTable, type OrderItem } from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";
import { sendEmail, fireAndForget } from "../lib/email";
import { orderConfirmationTemplate } from "../lib/email-templates";
import { getSiteUrl } from "../lib/config";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

function generateOrderNumber(): string {
  // 12 random hex chars + 4 random hex chars => ~64 bits of entropy, enumeration-resistant
  const a = randomBytes(6).toString("hex").toUpperCase();
  const b = randomBytes(2).toString("hex").toUpperCase();
  return `VC-${a}-${b}`;
}

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order payload", details: parsed.error.message });
    return;
  }
  const data = parsed.data;

  // Optionally link order to authenticated user
  let linkedUserId: number | null = null;
  const { userId: clerkId } = getAuth(req);
  if (clerkId) {
    const [dbUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.clerkId, clerkId));
    if (dbUser) linkedUserId = dbUser.id;
  }

  // Collapse duplicate productIds into single lines (sum quantities)
  const qtyByProductId = new Map<number, number>();
  for (const item of data.items) {
    qtyByProductId.set(item.productId, (qtyByProductId.get(item.productId) ?? 0) + item.quantity);
  }
  const productIds = [...qtyByProductId.keys()];
  if (productIds.length === 0) {
    res.status(400).json({ error: "Order must contain at least one item" });
    return;
  }

  try {
    const order = await db.transaction(async (tx) => {
      // Resolve product details and prices server-side; lock rows.
      const products = await tx
        .select()
        .from(productsTable)
        .where(inArray(productsTable.id, productIds))
        .for("update");

      // Detect missing products
      const foundIds = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new OrderError(404, `Product not found: ${missing.join(", ")}`);
      }

      // Build order lines from authoritative DB data; validate stock
      const items: OrderItem[] = [];
      for (const product of products) {
        const quantity = qtyByProductId.get(product.id)!;
        if (!product.inStock || product.stockCount < quantity) {
          throw new OrderError(409, `"${product.name}" is out of stock or insufficient inventory.`);
        }
        // Server-trusted unit price (always sourced from DB, never the client)
        const priceCents = product.priceCents;
        items.push({
          productId: product.id,
          name: product.name,
          brand: product.brand,
          imageUrl: product.imageUrl,
          priceCents,
          quantity,
        });
      }

      const subtotalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
      const shippingCents = subtotalCents >= 5000 ? 0 : 399;
      const taxCents = 0;
      const totalCents = subtotalCents + shippingCents;

      // Decrement stock atomically
      for (const product of products) {
        const quantity = qtyByProductId.get(product.id)!;
        await tx
          .update(productsTable)
          .set({ stockCount: sql`${productsTable.stockCount} - ${quantity}` })
          .where(eq(productsTable.id, product.id));
      }

      const [created] = await tx
        .insert(ordersTable)
        .values({
          orderNumber: generateOrderNumber(),
          userId: linkedUserId ?? undefined,
          email: data.email,
          customerName: data.customerName,
          shippingAddress: data.shippingAddress,
          shippingCity: data.shippingCity,
          shippingState: data.shippingState,
          shippingZip: data.shippingZip,
          shippingCountry: data.shippingCountry ?? "GB",
          items,
          subtotalCents,
          shippingCents,
          taxCents,
          totalCents,
          status: "pending",
        })
        .returning();
      return created;
    });

    const siteUrl = await getSiteUrl();
    const tpl = orderConfirmationTemplate({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      items: order.items as OrderItem[],
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      totalCents: order.totalCents,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingZip: order.shippingZip,
      siteUrl,
    });
    fireAndForget(sendEmail({ ...tpl, to: order.email, template: "order-confirmation" }));

    res.status(201).json(order);
  } catch (err) {
    if (err instanceof OrderError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log?.error?.({ err }, "order creation failed");
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.get("/orders/mine", async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [dbUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!dbUser) {
    res.json([]);
    return;
  }
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, dbUser.id))
    .orderBy(desc(ordersTable.createdAt));
  res.json(orders);
});

router.get("/orders/:orderNumber", async (req, res): Promise<void> => {
  const orderNumber = req.params.orderNumber;
  // Basic shape check to avoid arbitrary lookups
  if (!/^VC-[A-Z0-9]{6,16}-[A-Z0-9]{4}$/.test(orderNumber)) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.orderNumber, orderNumber));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(order);
});

class OrderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export default router;
