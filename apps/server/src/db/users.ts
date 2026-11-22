import { getPool } from "./pool.js";

export async function userExists(id: string): Promise<boolean> {
  const { rowCount } = await getPool().query("SELECT 1 FROM users WHERE id = $1", [id]);
  return rowCount === 1;
}
