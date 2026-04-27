import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

/**
 * Admin gate.
 *
 * Identity is bound to a server-issued bearer token rather than just a
 * client-supplied user id. The login/signup endpoints rotate `users.sessionToken`
 * and return it to the user it belongs to. Privileged callers must send:
 *
 *   Authorization: Bearer <sessionToken>
 *
 * The middleware looks up the user by that token (constant-time compare done
 * implicitly by SQL, which is fine for this scope) and rejects if the user is
 * missing or not flagged `isAdmin`. Spoofing requires obtaining the actual
 * token, not just guessing a user id.
 *
 * The matched user is attached to `req.adminUser` for downstream handlers.
 */
export type RequestWithAdmin = Request & { adminUser?: User };

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  const token = m ? m[1].trim() : "";
  if (!token) {
    res.status(401).json({ error: "Admin access required" });
    return;
  }
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.sessionToken, token));
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
