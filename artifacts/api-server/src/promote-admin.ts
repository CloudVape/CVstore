/**
 * One-off admin promotion script. Toggles the `isAdmin` flag on a user.
 *
 * Usage:
 *   tsx artifacts/api-server/src/promote-admin.ts <username>          # promote to admin
 *   tsx artifacts/api-server/src/promote-admin.ts <username> --revoke # revoke admin
 */
import { eq } from "drizzle-orm";
import { db, usersTable, pool } from "@workspace/db";

async function main() {
  const username = process.argv[2];
  const revoke = process.argv.includes("--revoke");
  if (!username) {
    console.error("Usage: tsx promote-admin.ts <username> [--revoke]");
    process.exit(1);
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));
  if (!user) {
    console.error(`User "${username}" not found`);
    process.exit(2);
  }
  await db
    .update(usersTable)
    .set({ isAdmin: !revoke })
    .where(eq(usersTable.id, user.id));
  console.log(
    `${revoke ? "Revoked admin from" : "Promoted to admin:"} ${user.username} (id ${user.id})`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
