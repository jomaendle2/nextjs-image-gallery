import process from "node:process";
import { sql } from "../src/lib/database.ts";
import { MIGRATIONS } from "../src/lib/schema.ts";

async function main(): Promise<void> {
  for (const statement of MIGRATIONS) {
    await sql.query(statement);
    console.log(`ok: ${statement.slice(0, 62).replace(/\s+/g, " ")}...`);
  }
  console.log(`Applied ${MIGRATIONS.length} statements.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
