// lib
import pg from "pg";

export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({ connectionString, max: 10 });
  // An idle client dropping must not crash the process; the pool replaces it.
  pool.on("error", (err) => console.error("postgres pool error", err.message));
  return pool;
}
