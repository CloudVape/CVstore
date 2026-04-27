import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, usersTable, type User } from "@workspace/db";

export type RequestWithAdmin = Request & { adminUser?: User };

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Admin access required" });
    return;
  }
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId));
    if (!user || !user.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    (req as RequestWithAdmin).adminUser = user;
    next();
  } catch (err) {
    req.log?.error?.({ err }, "admin auth lookup failed");
    res.status(500).json({ error: "Auth lookup failed" });
  }
}
