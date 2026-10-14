/**
 * The subset of PostgREST that LifeOS uses, executed against PGlite:
 *   GET/POST/PATCH/DELETE /rest/v1/<table>  with select, eq/neq/gt/gte/lt/lte/like/ilike/is,
 *   or=(...), order, limit/offset, Prefer: return=representation | count=exact,
 *   Accept: application/vnd.pgrst.object+json
 *   POST /rest/v1/rpc/<function>  with named JSON arguments
 *
 * Each request runs in a transaction as role "authenticated" (with the JWT claims) or
 * "anon", so the real RLS policies, grants, constraints and triggers decide the outcome.
 * Identifiers are validated against the catalog; values are always bound parameters.
 */
import type { PGlite, Transaction } from "@electric-sql/pglite";

export type RestRequest = {
  method: string;
  path: string;
  searchParams: URLSearchParams;
  headers: Record<string, string | undefined>;
  body: unknown;
  role: "anon" | "authenticated";
  claims: object | null;
};

export type RestResponse = { status: number; headers?: Record<string, string>; body?: unknown };

type Catalog = { tables: Map<string, Set<string>>; functions: Map<string, { returnsVoid: boolean }> };

class RestError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const FILTER_OPS: Record<string, string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "like",
  ilike: "ilike",
};
const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset", "or", "on_conflict", "columns"]);

export async function loadCatalog(db: PGlite): Promise<Catalog> {
  const columns = await db.query<{ table_name: string; column_name: string }>(
    "select table_name, column_name from information_schema.columns where table_schema = 'public'",
  );
  const tables = new Map<string, Set<string>>();
  for (const row of columns.rows) {
    if (!tables.has(row.table_name)) tables.set(row.table_name, new Set());
    tables.get(row.table_name)?.add(row.column_name);
  }
  const functions = await db.query<{ name: string; returns_void: boolean }>(
    `select p.proname as name, p.prorettype = 'void'::regtype as returns_void
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`,
  );
  return {
    tables,
    functions: new Map(functions.rows.map((row) => [row.name, { returnsVoid: row.returns_void }])),
  };
}

function quoteIdent(name: string): string {
  if (!IDENTIFIER.test(name)) throw new RestError(400, "PGRST100", `Invalid identifier: ${name}`);
  return `"${name}"`;
}

function requireColumn(catalog: Catalog, table: string, column: string): string {
  if (!catalog.tables.get(table)?.has(column)) {
    throw new RestError(400, "42703", `column ${table}.${column} does not exist`);
  }
  return quoteIdent(column);
}

/** Splits on commas that are outside double quotes and parentheses. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted && char === "\\" && i + 1 < input.length) {
      current += char + input[i + 1];
      i += 1;
      continue;
    }
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === "(") depth += 1;
    else if (!quoted && char === ")") depth -= 1;
    if (char === "," && !quoted && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\(.)/g, "$1");
  }
  return value;
}

class SqlBuilder {
  readonly params: unknown[] = [];
  add(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }
}

function buildCondition(catalog: Catalog, table: string, column: string, expression: string, sql: SqlBuilder): string {
  const dot = expression.indexOf(".");
  if (dot < 0) throw new RestError(400, "PGRST100", `Invalid filter: ${column}=${expression}`);
  const op = expression.slice(0, dot);
  const raw = unquote(expression.slice(dot + 1));
  const ident = requireColumn(catalog, table, column);
  if (op === "is") {
    if (raw === "null") return `${ident} is null`;
    if (raw === "true" || raw === "false") return `${ident} is ${raw}`;
    throw new RestError(400, "PGRST100", "Invalid is filter");
  }
  const sqlOp = FILTER_OPS[op];
  if (!sqlOp) throw new RestError(400, "PGRST100", `Unsupported operator: ${op}`);
  // PostgREST accepts * as a LIKE wildcard.
  const value = op === "like" || op === "ilike" ? raw.replace(/\*/g, "%") : raw;
  return `${ident} ${sqlOp} ${sql.add(value)}`;
}

function buildWhere(catalog: Catalog, table: string, params: URLSearchParams, sql: SqlBuilder): string {
  const conditions: string[] = [];
  for (const [key, value] of params) {
    if (key === "or") {
      const inner = value.replace(/^\(/, "").replace(/\)$/, "");
      const alternatives = splitTopLevel(inner).map((part) => {
        const dot = part.indexOf(".");
        return buildCondition(catalog, table, part.slice(0, dot), part.slice(dot + 1), sql);
      });
      conditions.push(`(${alternatives.join(" or ")})`);
    } else if (!RESERVED_PARAMS.has(key)) {
      conditions.push(buildCondition(catalog, table, key, value, sql));
    }
  }
  return conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
}

function buildOrder(catalog: Catalog, table: string, order: string | null): string {
  if (!order) return "";
  const terms = order.split(",").map((term) => {
    const [column, ...modifiers] = term.split(".");
    const parts = [requireColumn(catalog, table, column)];
    for (const modifier of modifiers) {
      if (modifier === "asc" || modifier === "desc") parts.push(modifier);
      else if (modifier === "nullsfirst") parts.push("nulls first");
      else if (modifier === "nullslast") parts.push("nulls last");
      else throw new RestError(400, "PGRST100", `Invalid order modifier: ${modifier}`);
    }
    return parts.join(" ");
  });
  return `order by ${terms.join(", ")}`;
}

function selectColumns(catalog: Catalog, table: string, select: string | null): string[] | null {
  if (!select || select === "*") return null;
  return select.split(",").map((column) => {
    requireColumn(catalog, table, column.trim());
    return column.trim();
  });
}

function pick(rows: Record<string, unknown>[], columns: string[] | null) {
  if (!columns) return rows;
  return rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
}

function wantsObject(headers: RestRequest["headers"]): boolean {
  return (headers.accept ?? "").includes("application/vnd.pgrst.object+json");
}

function prefer(headers: RestRequest["headers"]): string {
  return headers.prefer ?? "";
}

function respondRows(request: RestRequest, rows: Record<string, unknown>[], status: number, extra: Record<string, string> = {}): RestResponse {
  if (wantsObject(request.headers)) {
    if (rows.length !== 1) {
      return {
        status: 406,
        body: {
          code: "PGRST116",
          details: `The result contains ${rows.length} rows`,
          hint: null,
          message: "JSON object requested, multiple (or no) rows returned",
        },
      };
    }
    return { status, headers: extra, body: rows[0] };
  }
  return { status, headers: extra, body: rows };
}

async function asRole<T>(db: PGlite, request: RestRequest, run: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${request.role === "authenticated" ? "authenticated" : "anon"}`);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(request.claims ?? { role: "anon" })]);
    return run(tx);
  });
}

async function jsonRows(tx: Transaction, query: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const { rows } = await tx.query<{ data: Record<string, unknown>[] }>(
    `select coalesce(json_agg(r), '[]'::json) as data from (${query}) r`,
    params,
  );
  return rows[0]?.data ?? [];
}

/** Runs INSERT/UPDATE/DELETE ... RETURNING *. Data-modifying CTEs must be top-level in Postgres. */
async function mutationRows(tx: Transaction, statement: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const { rows } = await tx.query<{ data: Record<string, unknown>[] }>(
    `with changed as (${statement}) select coalesce(json_agg(changed), '[]'::json) as data from changed`,
    params,
  );
  return rows[0]?.data ?? [];
}

async function handleTable(db: PGlite, catalog: Catalog, table: string, request: RestRequest): Promise<RestResponse> {
  if (!catalog.tables.has(table)) {
    throw new RestError(404, "PGRST205", `Could not find the table 'public.${table}' in the schema cache`);
  }
  const target = `public.${quoteIdent(table)}`;
  const columns = selectColumns(catalog, table, request.searchParams.get("select"));
  const returnRepresentation = prefer(request.headers).includes("return=representation");

  if (request.method === "GET") {
    const sql = new SqlBuilder();
    const where = buildWhere(catalog, table, request.searchParams, sql);
    const order = buildOrder(catalog, table, request.searchParams.get("order"));
    const limit = Number(request.searchParams.get("limit") ?? "NaN");
    const offset = Number(request.searchParams.get("offset") ?? "0");
    const paging = `${Number.isInteger(limit) ? `limit ${limit}` : ""} ${Number.isInteger(offset) && offset > 0 ? `offset ${offset}` : ""}`;

    return asRole(db, request, async (tx) => {
      const rows = await jsonRows(tx, `select * from ${target} ${where} ${order} ${paging}`, sql.params);
      const headers: Record<string, string> = {};
      const start = Number.isInteger(offset) ? offset : 0;
      let total = "*";
      if (prefer(request.headers).includes("count=exact")) {
        const counted = await tx.query<{ count: number }>(`select count(*)::int as count from ${target} ${where}`, sql.params);
        total = String(counted.rows[0]?.count ?? 0);
      }
      headers["Content-Range"] = rows.length > 0 ? `${start}-${start + rows.length - 1}/${total}` : `*/${total}`;
      return respondRows(request, pick(rows, columns), 200, headers);
    });
  }

  if (request.method === "POST") {
    const records = Array.isArray(request.body) ? request.body : [request.body];
    if (records.length === 0 || records.some((record) => typeof record !== "object" || record === null)) {
      throw new RestError(400, "PGRST102", "Invalid body");
    }
    const keys = Object.keys(records[0] as object);
    keys.forEach((key) => requireColumn(catalog, table, key));
    const sql = new SqlBuilder();
    const values = records
      .map((record) => `(${keys.map((key) => sql.add((record as Record<string, unknown>)[key] ?? null)).join(", ")})`)
      .join(", ");
    return asRole(db, request, async (tx) => {
      const rows = await mutationRows(
        tx,
        `insert into ${target} (${keys.map(quoteIdent).join(", ")}) values ${values} returning *`,
        sql.params,
      );
      return returnRepresentation ? respondRows(request, pick(rows, columns), 201) : { status: 201 };
    });
  }

  if (request.method === "PATCH") {
    const record = request.body;
    if (typeof record !== "object" || record === null || Array.isArray(record)) {
      throw new RestError(400, "PGRST102", "Invalid body");
    }
    const sql = new SqlBuilder();
    const assignments = Object.entries(record).map(
      ([key, value]) => `${requireColumn(catalog, table, key)} = ${sql.add(value ?? null)}`,
    );
    if (assignments.length === 0) return { status: 204 };
    const where = buildWhere(catalog, table, request.searchParams, sql);
    return asRole(db, request, async (tx) => {
      const rows = await mutationRows(tx, `update ${target} set ${assignments.join(", ")} ${where} returning *`, sql.params);
      return returnRepresentation ? respondRows(request, pick(rows, columns), 200) : { status: 204 };
    });
  }

  if (request.method === "DELETE") {
    const sql = new SqlBuilder();
    const where = buildWhere(catalog, table, request.searchParams, sql);
    return asRole(db, request, async (tx) => {
      const rows = await mutationRows(tx, `delete from ${target} ${where} returning *`, sql.params);
      return returnRepresentation ? respondRows(request, pick(rows, columns), 200) : { status: 204 };
    });
  }

  throw new RestError(405, "PGRST117", `Unsupported method ${request.method}`);
}

async function handleRpc(db: PGlite, catalog: Catalog, name: string, request: RestRequest): Promise<RestResponse> {
  const fn = catalog.functions.get(name);
  if (!fn) throw new RestError(404, "PGRST202", `Could not find the function public.${name} in the schema cache`);
  const args = (request.body ?? {}) as Record<string, unknown>;
  const sql = new SqlBuilder();
  const named = Object.entries(args).map(([key, value]) => `${quoteIdent(key)} => ${sql.add(value ?? null)}`);
  const call = `public.${quoteIdent(name)}(${named.join(", ")})`;

  return asRole(db, request, async (tx) => {
    if (fn.returnsVoid) {
      await tx.query(`select ${call}`, sql.params);
      return { status: 204 };
    }
    const { rows } = await tx.query<{ data: unknown }>(`select to_json(${call}) as data`, sql.params);
    return { status: 200, body: rows[0]?.data ?? null };
  });
}

/** Maps a Postgres error to PostgREST's HTTP status and JSON error shape. */
function errorResponse(error: unknown, request: RestRequest): RestResponse {
  if (error instanceof RestError) {
    return { status: error.status, body: { code: error.code, message: error.message, details: null, hint: null } };
  }
  const pg = error as { code?: string; message?: string; detail?: string; hint?: string };
  const code = pg.code ?? "XX000";
  const status =
    code === "23505" || code === "23503" || code === "23001"
      ? 409
      : code === "42501"
        ? request.role === "anon"
          ? 401
          : 403
        : code === "P0002"
          ? 404
          : code.startsWith("22") || code.startsWith("23") || code === "P0001"
            ? 400
            : 500;
  return {
    status,
    body: { code, message: pg.message ?? "Database error", details: pg.detail ?? null, hint: pg.hint ?? null },
  };
}

export function createRest(db: PGlite, catalogPromise: Promise<Catalog>) {
  return async function handle(request: RestRequest): Promise<RestResponse> {
    const catalog = await catalogPromise;
    try {
      const [, kind, name] = /^\/rest\/v1\/(rpc\/)?([a-z_][a-z0-9_]*)$/.exec(request.path) ?? [];
      if (!name) throw new RestError(404, "PGRST125", "Invalid path");
      return kind ? await handleRpc(db, catalog, name, request) : await handleTable(db, catalog, name, request);
    } catch (error) {
      return errorResponse(error, request);
    }
  };
}
