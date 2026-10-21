// node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { Queryable } from "../repositories/user.repository.js";

/** Applies every .sql file in `dir` that has not run yet, in filename (timestamp) order. */
export async function migrate(db: Queryable, dir: string): Promise<string[]> {
  await db.query(
    `create table if not exists schema_migrations (
       name text primary key,
       applied_at timestamptz not null default now()
     )`,
  );
  const { rows } = await db.query<{ name: string }>("select name from schema_migrations");
  const done = new Set(rows.map((row) => row.name));

  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    await db.query(await readFile(path.join(dir, file), "utf8"));
    await db.query("insert into schema_migrations (name) values ($1)", [file]);
    applied.push(file);
  }
  return applied;
}
