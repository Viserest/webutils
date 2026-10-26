
import { type IRequest, type RouterType } from "itty-router";
import * as d from "drizzle-orm";
import { drizzle, DrizzleD1Database, type AnyD1Database } from "drizzle-orm/d1";
import * as s from "drizzle-orm/sqlite-core";

import { nowSecs, parseToObject, reply, toInt } from "./utils.ts";
import { Uuid } from "./uuid.ts";
import { defineForm, type Fields, type FormMethod, type FormResult } from "./form.ts";
import { tag } from "./tag.ts";

//
// Types
//

/** A Drizzle sqliteTable that has an `id` column. */
export type TableWithId = s.SQLiteTable & { id: s.SQLiteColumn };

/** Column keys of a table, e.g. "id" | "name" | "email". */
export type Field<T extends s.SQLiteTable> = keyof T["$inferSelect"] & string;

/** Payload for create: the whole insert model, or only the chosen fields. */
export type CreatePayload<T extends s.SQLiteTable, K extends Field<T> = Field<T>> =
	Pick<T["$inferInsert"], Extract<K, keyof T["$inferInsert"]>>;

/** Payload for update: same as create, but every field is optional. */
export type UpdatePayload<T extends s.SQLiteTable, K extends Field<T> = Field<T>> =
	Partial<CreatePayload<T, K>>;

/** Shape returned by read/list: the whole row, or only the chosen fields. */
export type ReadPayload<T extends s.SQLiteTable, K extends Field<T> = Field<T>> =
	Pick<T["$inferSelect"], K>;

export type OpType = "list" | "create" | "read" | "update" | "delete";

//
// Handlers
//

/** A before step: may return a Response (stop), fields to add to req, or nothing. */
export type BeforeHandler<In = IRequest, A extends any[] = any[], Add extends object = {}> = (
	req: In,
	...args: A
) => Response | Add | void | Promise<Response | Add | void>;

export type MainHandler<Req = IRequest, A extends any[] = any[]> = (
	req: Req,
	...args: A
) => Response | Promise<Response>;

export type AfterHandler<Req = IRequest, A extends any[] = any[]> = (
	res: Response,
	req: Req,
	...args: A
) => Response | void | Promise<Response | void>;

// ---- type-level accumulation ------------------------------------------------

/** Fields a step adds. Response/void-only steps add nothing ({}). */
type Added<H> = H extends (...a: any[]) => infer R
	? [Exclude<Awaited<R>, Response | void | undefined | null>] extends [never]
		? {}
		: Exclude<Awaited<R>, Response | void | undefined | null>
	: {};

/** Request type after running every step in the tuple. */
type Accum<Base, Hs extends readonly unknown[]> =
	Hs extends readonly [infer H, ...infer Rest] ? Accum<Base & Added<H>, Rest> : Base;

/** Each step must accept the request as built by the steps before it. */
type Checked<Base, A extends any[], Hs extends readonly unknown[]> =
	Hs extends readonly [infer H, ...infer Rest]
		? readonly [BeforeHandler<Base, A, object>, ...Checked<Base & Added<H>, A, Rest>]
		: readonly [];

/** `any` stays `any`, so loosely typed options still work. */
type ReqOf<Base, B extends readonly any[]> = 0 extends 1 & B ? any : Accum<Base, B>;

// ---- options ------------------------------------------------------------------

export interface HandlerOption<Base, A extends any[], B extends readonly BeforeHandler<any, A, any>[] = any> {
	/** Handlers that run before the main handler. Their returned fields are merged into req. */
	before?: B & Checked<Base, A, B>;
	/** Handlers that run after the main handler. Receive the fully extended req. */
	after?: readonly AfterHandler<ReqOf<Base, B>, A>[];
	/** Custom main handler. When omitted, the default handler for this operation runs. */
	handler?: MainHandler<ReqOf<Base, B>, A>;
	/** Success message used by the default handler. Ignored when `handler` is provided. */
	message?: string;
}

/** Infers the request type per operation. Wrap an operation's options in this. */
export const op = <const B extends readonly BeforeHandler<any, any>[]>(
	o: HandlerOption<B> & { fields?: readonly any[]; soft?: boolean },
) => o;

//
// options
//

/** `fields` limits which columns are used. Omit it to use the entire table. */
interface FieldOption<T extends s.SQLiteTable> extends HandlerOption {
	fields?: readonly Field<T>[];
}

export interface DeleteOption extends HandlerOption {
	/**
	 * true  -> UPDATE <table> SET deleted_at = <now> WHERE id = ?
	 * false -> DELETE FROM <table> WHERE id = ?   (default)
	 * Soft delete requires a `deleted_at` column on the table.
	 */
	soft?: boolean;
}

/** Every key is required. Set one to `null` to skip that route. */
export interface RouteOptions<T extends TableWithId> {
	table: T;
	list: FieldOption<T> | null;
	create: FieldOption<T> | null;
	read: FieldOption<T> | null;
	update: FieldOption<T> | null;
	delete: DeleteOption | null;
}

/** What each form's parseBody() produces. */
interface Payloads<T extends TableWithId> {
	list: { limit?: string; offset?: string };
	create: CreatePayload<T>;
	read: { id: string };
	update: { id: string } & UpdatePayload<T>;
	delete: { id: string };
}

/** Each handler key maps to its FormResult, or null when it was skipped. */
export type HandlerResult<T extends TableWithId, O extends RouteOptions<T>> = {
	[K in OpType]: O[K] extends null ? null : FormResult<Fields, Payloads<T>[K]>;
} & {
	/** All configured forms, wrapped in a single <div>. */
	renderAll(): Element;
};

//
// The Handler
//

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Create D1 Database from schema and Cloudflare Bindings */
export function createD1Database(schema: any, db: AnyD1Database): DrizzleD1Database<typeof schema> {
  return drizzle(db, { schema });
}

/**
 *
 * // One line per project:
 * export const { handler, op } = createHandlers<IRequest, [Bindings, ExecutionContext]>({
 *   getDb: (req, env) => (req as any).db ?? createD1Database(env),
 * });
 *
 * @param cfg
 * @returns
 */
export function createHandlers<Base extends IRequest, A extends any[]>(cfg: {
	/** Where the default handlers get their db. Replaces the hard-coded `req.db ?? createDb(env)`. */
	getDb: (req: Base, ...args: A) => Db;
}) {
	const chain =
		(opt: HandlerOption<Base, A, any>, fallback: MainHandler<any, A>): MainHandler<Base, A> =>
		async (req, ...args) => {
			for (const before of (opt.before ?? []) as readonly BeforeHandler<any, A, any>[]) {
				const out = await before(req, ...args);
				if (out instanceof Response) return out;
				if (out) Object.assign(req, out);
			}
			let res = await (opt.handler ?? fallback)(req, ...args);
			for (const after of (opt.after ?? []) as readonly AfterHandler<any, A>[]) {
				res = (await after(res, req, ...args)) ?? res;
			}
			return res;
		};

	const op = <const B extends readonly BeforeHandler<any, A, any>[]>(
		o: HandlerOption<Base, A, B> & { fields?: readonly any[]; soft?: boolean },
	) => o;

	function handler<R extends RouterType<any, A>, T extends TableWithId, O extends RouteOptions<T>>(
		router: R, path: string, options: O & RouteOptions<T>,
	): HandlerResult<T, O> {
		// body as before, but default handlers use:
		//   async (req, ...args) => { const db = cfg.getDb(req, ...args); ... }
		// Get table
		const { table } = options;
		const columns = d.getTableColumns(table) as Record<string, s.SQLiteColumn>;

		// Get id column
		const idColumn = columns["id"]!;

		// Get deleted at column
		const deletedKey = Object.keys(columns).find((k) => columns[k]!.name === "deleted_at");
		const deletedColumn = deletedKey ? columns[deletedKey] : undefined;

		// Soft-deleted rows are hidden from list/read/update
		const notDeleted = deletedColumn ? d.isNull(deletedColumn) : undefined;

		// Table must have deleted at column for a soft delete
		if (options.delete?.soft && !deletedColumn) {
			throw new Error("handler: soft delete needs a `deleted_at` column on the table");
		}

		/**
		 * Columns to select: chosen fields or the entire table (default).
		 * If fields is provided then filter columns to only those fields.
		 */
		const columnSelect = (fields?: readonly string[]) => {
			const keys = (fields ?? Object.keys(columns)).filter((k) => k in columns);
			return Object.fromEntries(keys.map((k) => [k, columns[k]!])) as Record<string, s.SQLiteColumn>;
		};

		/**
		 * Keys a client may write: chosen fields or the entire table.
		 * Skips id and deleted_at columns
		 */
		const columnWritableKeys = (fields?: readonly string[]) =>
			(fields ?? Object.keys(columns)).filter((k) => k in columns && k !== "id" && k !== deletedKey);

		/** Build form fields for a set of columns. */
		const bodyFields = (keys: string[], allOptional: boolean): Fields =>
			Object.fromEntries(
				keys.map((k) => {
					const col = columns[k]!;
					const type = /pass/i.test(k) ? "password" : /mail/i.test(k) ? "email" : "text";
					// Required only if the DB requires it: NOT NULL and no default.
					const optional = allOptional || !col.notNull || col.hasDefault;
					return [k, { type, placeholder: k, ...(optional && { optional: true as const }) }];
				}),
			);

		const idField: Fields = { id: { type: "text", placeholder: "id" } };

		const forms: Record<OpType, FormResult<Fields, any> | null> = {
			list: null,
			create: null,
			read: null,
			update: null,
			delete: null,
		};

		// LIST
		if (options.list) {
			const opt = options.list;
			router.get(
				path,
				chain(opt, async (req, env) => {
					const db = req.db ?? createD1Database(schema, binding_db);
					const limit = Math.min(toInt(req.query?.limit, DEFAULT_LIMIT), MAX_LIMIT);
					const offset = toInt(req.query?.offset, 0);

					const items = await db
						.select(columnSelect(opt.fields))
						.from(table)
						.where(notDeleted)
						.limit(limit)
						.offset(offset);
					const [{ total } = { total: 0 }] = await db
						.select({ total: d.count() })
						.from(table)
						.where(notDeleted);

					return reply(opt.message ?? "Found items", 200, {
						offset,
						limit,
						total,
						items,
					});
				}),
			);
			forms.list = defineForm({
				method: "GET",
				href: path,
				fields: {
					limit: { type: "text", placeholder: "limit" },
					offset: { type: "text", placeholder: "offset" },
				},
			});
		}

		// CREATE
		if (options.create) {
			const opt = options.create;
			router.post(
				path,
				chain(opt, async (req, env) => {
					const db = req.db ?? createD1Database(schema, binding_db);
					const body = await req.json().catch(() => undefined);
					const data = parseToObject(body, columnWritableKeys(opt.fields));
					if (!data) return reply("Body must be a JSON object", 400);

					const id = Uuid.randomv4();
					await db.insert(table).values({
						...data,
						id: id.toBytes(),
					} as unknown as T["$inferInsert"]);

					return reply(opt.message ?? "Created", 201, {
						id: id.toString(),
					});
				}),
			);
			forms.create = defineForm({
				method: "POST",
				href: path,
				fields: bodyFields(columnWritableKeys(opt.fields), false),
			});
		}

		// READ
		if (options.read) {
			const opt = options.read;
			router.get(
				path + "/:id",
				chain(opt, async (req, env) => {
					const db = req.db ?? createD1Database(schema, binding_db);
					const id = req.params["id"];
					if (!id) return reply("Missing required field, id", 400);

					const [item] = await db
						.select(columnSelect(opt.fields))
						.from(table)
						.where(d.and(d.eq(idColumn, id), notDeleted))
						.limit(1);
					if (!item) return reply("Not found", 404);

					return reply(opt.message ?? "Found item", 200, {
						item,
					});
				}),
			);
			forms.read = defineForm({
				method: "GET",
				href: path + "/:id",
				fields: idField,
			});
		}

		// UPDATE
		if (options.update) {
			const opt = options.update;
			router.put(
				path + "/:id",
				chain(opt, async (req, env) => {
					const db = req.db ?? createD1Database(schema, binding_db);
					const id = req.params["id"];
					if (!id) return reply("Missing required field, id", 400);

					const body = await req.json().catch(() => undefined);
					const data = parseToObject(body, [], columnWritableKeys(opt.fields));
					if (!data) return reply("Body must be a JSON object", 400);
					if (Object.keys(data).length === 0) return reply("No updatable fields provided", 400);

					const updated = await db
						.update(table)
						.set(data as unknown as Partial<T["$inferInsert"]>)
						.where(d.and(d.eq(idColumn, id), notDeleted))
						.returning({ id: idColumn });
					if (updated.length === 0) return reply("Not found", 404);

					return reply(opt.message ?? "Updated", 200);
				}),
			);
			forms.update = defineForm({
				method: "PUT",
				href: path + "/:id",
			  fields: {
					...idField,
					// every field optional
					...bodyFields(columnWritableKeys(opt.fields), true),
				},
			});
		}

		// DELETE
		if (options.delete) {
			const opt = options.delete;
			router.delete(
				path + "/:id",
				chain(opt, async (req, env) => {
					const db = req.db ?? createD1Database(schema, binding_db);
					const id = req.params["id"];
					if (!id) return reply("Missing required field, id", 400);

					const deleted = opt.soft
						? await db
								.update(table)
								.set({ [deletedKey!]: nowSecs() } as unknown as Partial<T["$inferInsert"]>)
								.where(d.and(d.eq(idColumn, id), notDeleted))
								.returning({ id: idColumn })
						: await db.delete(table).where(d.eq(idColumn, id)).returning({ id: idColumn });
					if (deleted.length === 0) return reply("Not found", 404);

					return reply(opt.message ?? "Deleted", 200);
				}),
			);
			forms.delete = defineForm({
				method: "DELETE",
				href: path + "/:id",
				fields: idField,
			});
		}

		const renderAll = () =>
			tag(
				"div",
				{},
				...Object.entries(forms)
					.filter(([, f]) => f !== null)
					.map(([type, f]) => f!.render({ submit_text: type })),
			);

		return { ...forms, renderAll } as unknown as HandlerResult<T, O>;
	}

	return { handler, op, chain };
}
