import { beforeEach, expect, it } from "vitest";
import { getPool, withTransaction } from "../src/db/pool.js";
import { describeDb, resetDb } from "./helpers.js";

const userCount = async () => (await getPool().query<{ n: number }>("SELECT COUNT(*)::int AS n FROM users")).rows[0].n;

async function insertUserIn(client: { query: (sql: string) => Promise<unknown> }) {
  await client.query("INSERT INTO users (name, email, password_hash) VALUES ('Tx', 'tx@example.com', 'x')");
}

describeDb("withTransaction", () => {
  beforeEach(resetDb);

  it("commits fn's work and returns its result", async () => {
    const result = await withTransaction(async (client) => {
      await insertUserIn(client);
      return "done";
    });
    expect(result).toBe("done");
    expect(await userCount()).toBe(1);
  });

  it("when fn throws: the original error propagates, the work is rolled back, the pool keeps serving", async () => {
    const original = new Error("boom from fn");
    await expect(
      withTransaction(async (client) => {
        await insertUserIn(client);
        throw original;
      }),
    ).rejects.toBe(original);
    expect(await userCount()).toBe(0);
    expect((await getPool().query("SELECT 1 AS ok")).rows).toEqual([{ ok: 1 }]);
  });

  it("a failing SQL statement propagates its own pg error, and the next transaction works", async () => {
    await expect(withTransaction((client) => client.query("SELECT * FROM no_such_table"))).rejects.toMatchObject({
      code: "42P01",
    });
    await withTransaction(insertUserIn);
    expect(await userCount()).toBe(1);
  });

  it("a connection that dies mid-transaction is discarded without crashing; the pool keeps serving", async () => {
    // pg emits 'error' on a checked-out client whose connection drops; pg-pool only listens while the
    // client is idle, so without a listener here the process gets an uncaught exception. Checked first
    // so this test fails cleanly instead of crashing the worker.
    const failure = withTransaction(async (client) => {
      expect(client.listenerCount("error"), "withTransaction must listen for client 'error'").toBeGreaterThan(0);
      // Killing our own backend makes both this query and the ROLLBACK fail.
      await client.query("SELECT pg_terminate_backend(pg_backend_pid())");
    });
    await expect(failure).rejects.toThrow(/terminat/i);
    for (let i = 0; i < 3; i++) {
      expect((await getPool().query("SELECT 1 AS ok")).rows).toEqual([{ ok: 1 }]);
    }
  });
});
