// 实验性内置模块 node:sqlite 在 @types/node 20 下没有类型声明，这里补一份最小声明。
// 运行时需 Node >= 22.5 并启用 --experimental-sqlite。
declare module "node:sqlite" {
  export interface SqliteOptions {
    mode?: number;
    allowExtension?: boolean;
    enableForeignKeyConstraints?: boolean;
  }

  export interface StatementResult {
    lastInsertRowid: number | bigint;
    changes: number;
  }

  export interface StatementSync {
    run(...params: unknown[]): StatementResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    iterate(...params: unknown[]): IterableIterator<unknown>;
  }

  export class DatabaseSync {
    constructor(path?: string, options?: SqliteOptions);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
