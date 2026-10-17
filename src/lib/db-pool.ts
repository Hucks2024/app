import type { PrismaLibSql } from "@prisma/adapter-libsql/web";

// Prisma's own names for these, by way of the adapter the app uses.
type SqlDriverAdapterFactory = Pick<PrismaLibSql, "provider" | "adapterName" | "connect">;
type SqlDriverAdapter = Awaited<ReturnType<PrismaLibSql["connect"]>>;
type Transaction = Awaited<ReturnType<SqlDriverAdapter["startTransaction"]>>;
type SqlQuery = Parameters<SqlDriverAdapter["queryRaw"]>[0];
type IsolationLevel = Parameters<SqlDriverAdapter["startTransaction"]>[0];

// A few database connections behind one, so the queries a page asks for at
// once (Promise.all) really do go at once.
//
// Prisma's libSQL adapter runs one statement at a time per connection, so
// a page that asks for six things at the same moment still waits for each
// in turn: six trips to Turso, end to end. Over HTTP every statement is
// its own request anyway, so a handful of connections, each taking the
// next query when it's free, costs nothing and turns those six trips into
// one. A transaction keeps its connection to itself until it's done, as
// before; the others carry on.

/** `size` connections made by `make`, as one. */
export function pooled(make: () => SqlDriverAdapterFactory, size: number): SqlDriverAdapterFactory {
  const first = make();
  return {
    provider: first.provider,
    adapterName: first.adapterName,
    async connect() {
      const factories = [first, ...Array.from({ length: size - 1 }, make)];
      return new Pool(await Promise.all(factories.map((f) => f.connect())));
    },
  };
}

class Pool implements SqlDriverAdapter {
  readonly provider: SqlDriverAdapter["provider"];
  readonly adapterName: string;
  // How many queries (or open transactions) each connection has right now.
  private readonly load: number[];

  constructor(private readonly members: SqlDriverAdapter[]) {
    this.provider = members[0].provider;
    this.adapterName = members[0].adapterName;
    this.load = members.map(() => 0);
  }

  /** The least busy connection, marked as one busier. */
  private take(): number {
    let best = 0;
    for (let i = 1; i < this.members.length; i++) if (this.load[i] < this.load[best]) best = i;
    this.load[best]++;
    return best;
  }

  private async on<T>(run: (member: SqlDriverAdapter) => Promise<T>): Promise<T> {
    const i = this.take();
    try {
      return await run(this.members[i]);
    } finally {
      this.load[i]--;
    }
  }

  queryRaw(query: SqlQuery) {
    return this.on((m) => m.queryRaw(query));
  }

  executeRaw(query: SqlQuery) {
    return this.on((m) => m.executeRaw(query));
  }

  executeScript(script: string) {
    return this.on((m) => m.executeScript(script));
  }

  /** The connection stays counted as busy until the transaction ends, so
   * other queries go to the others rather than queueing behind it. */
  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    const i = this.take();
    let open = true;
    const done = () => {
      if (open) this.load[i]--;
      open = false;
    };
    let tx: Transaction;
    try {
      tx = await this.members[i].startTransaction(isolationLevel);
    } catch (e) {
      done();
      throw e;
    }
    return {
      provider: tx.provider,
      adapterName: tx.adapterName,
      options: tx.options,
      queryRaw: (query) => tx.queryRaw(query),
      executeRaw: (query) => tx.executeRaw(query),
      commit: () => tx.commit().finally(done),
      rollback: () => tx.rollback().finally(done),
      ...(tx.createSavepoint && { createSavepoint: (name: string) => tx.createSavepoint!(name) }),
      ...(tx.rollbackToSavepoint && { rollbackToSavepoint: (name: string) => tx.rollbackToSavepoint!(name) }),
      ...(tx.releaseSavepoint && { releaseSavepoint: (name: string) => tx.releaseSavepoint!(name) }),
    };
  }

  getConnectionInfo() {
    return this.members[0].getConnectionInfo?.() ?? { supportsRelationJoins: false };
  }

  async dispose() {
    await Promise.all(this.members.map((m) => m.dispose()));
  }
}
