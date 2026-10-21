// node
import { fileURLToPath } from "node:url";

import { env } from "./config/env.js";
import { createPool } from "./services/database.service.js";
import { migrate } from "./services/migrate.service.js";

const pool = createPool(env.databaseUrl);
try {
  const applied = await migrate(pool, fileURLToPath(new URL("../migrations", import.meta.url)));
  console.log(applied.length ? `applied ${applied.join(", ")}` : "database is up to date");
} finally {
  await pool.end();
}
