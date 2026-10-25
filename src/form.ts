
import { Element, form, tag } from "./tag.ts";
import { type Result, Err } from "./result.ts";
import { parseToObject } from "./utils.ts";

export type FieldDef = {
	type: "text" | "email" | "password";
  placeholder?: string;
	// fields are required unless marked optional
	optional?: true;
};
export type Fields = Record<string, FieldDef>;

/** Builds type from the field definitions */
export type Infer<F extends Fields> =
	{ [K in keyof F as F[K] extends { optional: true } ? never : K]: string } &
	{ [K in keyof F as F[K] extends { optional: true } ? K : never]?: string };

export type FormMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RenderOptions {
	submit_text?: string;
	message_text?: string;
}

export interface FormResult<F extends Fields, Data = Infer<F>> {
	href: string;
	method: FormMethod;
	fields: F,

	/** Frontend: HTML form for this operation. */
	render(pla?: RenderOptions): Element;
	/** Backend: validate an already-parsed body. */
	parseBody(body: unknown): Result<Data>;
	/** Backend: read JSON from the request, then validate. */
	parseRequest(req: Request): Promise<Result<Data>>;
}

export function defineForm<const F extends Fields>(def: {
	href: string;
	method: FormMethod;
	fields: F;
}): FormResult<F> {
	const { href, method, fields } = def;
	type Data = Infer<F>;

	return {
		href,
		method,
		fields,

		/** Frontend: Render a form using tag.form() */
		render(pla?: RenderOptions) {
			return form({
				href,
				method,
				submit_text: pla?.submit_text,
				message_text: pla?.message_text,
			},
				...Object.entries(fields).map(([name, f]) =>
					tag("input", {
						type: f.type,
						name,
						...(f.placeholder && { placeholder: f.placeholder }),
						...(!f.optional && { required: "" }),
					}),
				),
			);
		},

		/** Backend: Validate an already-parsed body */
		parseBody(body: unknown): Result<Data> {
			// This has to be terrible because its looping over fields twice
			const keysRequired = Object.entries(fields)
				.filter(([name, f]) => !f.optional)
				.map(([name, f]) => name);
			const keysOptional = Object.entries(fields)
				.filter(([name, f]) => f.optional)
				.map(([name, f]) => name);
			return parseToObject<Data>(body, keysRequired, keysOptional);
		},

		/** Backend: Parse JSON from the request, then validate */
		async parseRequest(req: Request): Promise<Result<Data>> {
			let body: unknown;
			try {
				body = await req.json();
			} catch {
				return Err("Invalid JSON");
			}
			return this.parseBody(body);
		},
	};
}
