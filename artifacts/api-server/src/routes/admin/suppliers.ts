import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db, suppliersTable, type SupplierColumnMapping, type SupplierSchedule } from "@workspace/db";

const router: IRouter = Router();

const ScheduleSchema = z
  .object({
    enabled: z.boolean(),
    frequency: z.enum(["hourly", "daily", "weekly", "manual"]),
    hourOfDay: z.number().int().min(0).max(23).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .nullable();

const SupplierBody = z.object({
  name: z.string().trim().min(1).max(200),
  sourceType: z.enum(["csv-upload", "csv-url"]),
  sourceUrl: z.string().trim().url().max(2000).nullable().optional(),
  columnMapping: z.record(z.string(), z.string()).optional(),
  schedule: ScheduleSchema.optional(),
});

router.get("/admin/suppliers", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(suppliersTable)
    .orderBy(desc(suppliersTable.updatedAt));
  res.json(rows);
});

router.get("/admin/suppliers/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid supplier id" });
    return;
  }
  const [row] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.json(row);
});

router.post("/admin/suppliers", async (req, res): Promise<void> => {
  const parsed = SupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid supplier", details: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const [row] = await db
    .insert(suppliersTable)
    .values({
      name: data.name,
      sourceType: data.sourceType,
      sourceUrl: data.sourceUrl ?? null,
      columnMapping: (data.columnMapping ?? {}) as SupplierColumnMapping,
      schedule: (data.schedule ?? null) as SupplierSchedule | null,
    })
    .returning();
  res.status(201).json(row);
});

router.put("/admin/suppliers/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid supplier id" });
    return;
  }
  const parsed = SupplierBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid supplier", details: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.sourceType !== undefined) patch.sourceType = data.sourceType;
  if (data.sourceUrl !== undefined) patch.sourceUrl = data.sourceUrl ?? null;
  if (data.columnMapping !== undefined) patch.columnMapping = data.columnMapping;
  if (data.schedule !== undefined) patch.schedule = data.schedule ?? null;

  const [row] = await db
    .update(suppliersTable)
    .set(patch)
    .where(eq(suppliersTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.json(row);
});

router.delete("/admin/suppliers/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid supplier id" });
    return;
  }
  const result = await db.delete(suppliersTable).where(eq(suppliersTable.id, id)).returning();
  if (result.length === 0) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.status(204).end();
});

export default router;
