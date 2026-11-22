import type pg from "pg";

// Lets repo functions run on the pool or inside a transaction's client.
export type Queryable = pg.Pool | pg.PoolClient;
