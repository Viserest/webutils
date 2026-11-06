
import { Element, tag, type Node } from "./tag";
import { type Result, Err, Ok } from "./result";
import { Uuid } from "./uuid";

/**
 * Form element creation
 */

export type FormMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type FormElementSpecial =
  // If id is defined
  | {
      id: string;
      placement?: never;
      text?: never;
  }
  // If id is not defined
  | {
      id?: never;
      placement?: "top" | "bottom";
      text?: string;
    };

export interface FormOption {
  href: string,
  method: FormMethod,
  submit?: FormElementSpecial,
  message?: FormElementSpecial,
}

export function form(options: FormOption, ...children: Node[]): Element {
  const idForm = Uuid.randomv4().toHex();
  const idSubmit = options.submit?.id ?? Uuid.randomv4().toHex();
  const idMessage = options.message?.id ?? Uuid.randomv4().toHex();
  const result = tag("form", {
    "id": idForm,
    "action": options.href,
    "method": options.method,
  });

  const place = (placement: "top" | "bottom", id: string, special?: FormElementSpecial) => {
    // If not defined at all OR defined, no id, and placement is top
    if (!special || (special && !special.id && special.placement === placement)) {
      result.childrenAppend(tag("p", { "id": id }, special?.text || ""));
    }
  };

  place("top", idSubmit, options.submit);
  place("top", idMessage, options.message);

  result.childrenAppend(...children);

  place("bottom", idSubmit, options.submit);
  place("bottom", idMessage, options.message);

  result.childrenAppend(tag("script", {
    "src": "",
    "data-form_id": idForm,
    "data-message_id": idMessage,
  }));
  return result;
}

/**
 * Form frontend and backend creation
 *
 * ```typescript
 * const loginForm = defineForm("/api/login", "post", {
 *   "username?": [(i) => i.trim(), (i) => maxLength(i, 256)],
 *   "email":     [(i) => i.trim().toLowerCase(), (i) => maxLength(i, 256), (i) => isEmail(i)],
 *   "password":  [(i) => maxLength(i, 1024), (i) => hashPassword(i)],
 * });
 * loginForm.render(
 *   {},
 *   tag("p", { id: "message" }),
 *   tag("input", { type: "text", name: "username" }),
 *   tag("input", { type: "email", name: "email", required: "true" }),
 *   tag("input", { type: "password", name: "password", required: "true" }),
 *   tag("input", { type: "submit" }),
 * );
 * loginForm.parseBody({
 *   email: "  A@B.com ",
 *   password: "hunter2"
 * });
 * ```
 */

/**
 * A step is a string (replaces the current input), a boolean (true = continue,
 * false = error), or a thunk receiving the *current* input and returning either.
 */
type Step = (i: string) => string | boolean;
type Fields = Record<string, Step[]>;

// Optional fields are declared with a "?" suffix on the key: "username?": ...
type OptionalKeys<F> = { [K in keyof F]: K extends `${string}?` ? K : never }[keyof F];
type RequiredKeys<F> = Exclude<keyof F, OptionalKeys<F>>;
type StripQ<K> = K extends `${infer N}?` ? N : K;
type FormValue<F> =
  { [K in RequiredKeys<F> & string]: string } &
  { [K in OptionalKeys<F> & string as StripQ<K> & string]?: string; };

export interface FormResult<F extends Fields> {
	href: string;
	method: FormMethod;
	fields: F,

	/** Frontend: HTML form for this operation. */
	render(overrides: { href?: string; method?: FormMethod }, ...children: Element[]): Element;
	/** Backend: validate an already-parsed body. */
	parseBody(body: unknown): Result<FormValue<F>>;
	/** Backend: read JSON from the request, then validate. */
	parseRequest(req: Request): Promise<Result<FormValue<F>>>;
}

export function defineForm<const F extends Fields>(def: {
	href: string;
	method: FormMethod;
	fields: F;
}): FormResult<F> {
	const { href, method, fields } = def;

  const specs = Object.entries(fields).map(([key, fn]) => {
    const optional = key.endsWith("?");
    return { name: optional ? key.slice(0, -1) : key, optional, fn };
  });

	/** Frontend: Render a form using tag.form() */
	function render(
    overrides: { href?: string; method?: FormMethod },
    ...children: Element[]
  ): Element {
    const collectNames = (els: Element[], out = new Set<string>()): Set<string> => {
      for (const el of els) {
        if (el.attributes.name !== undefined) out.add(el.attributes.name);
        collectNames(el.children as Element[], out);
      }
      return out;
    };

    const present = collectNames(children);
    const missing = specs.map((s) => s.name).filter((n) => !present.has(n));
    if (missing.length) {
      throw new Error(`Form is missing element(s) with attribute.name: ${missing.join(", ")}`);
    }

    return form({
      href: overrides.href ?? href,
      method: overrides.method ?? method,
    }, ...children);
  }

	/** Backend: Validate an already-parsed body */
	function parseBody(body: unknown): Result<FormValue<F>> {
	  const value: Record<string, string> = {};
    let errors = "";

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return Err("Body must be an object");
    }
    const data = body as Record<string, unknown>;

    for (const { name, optional, fn } of specs) {
      const raw = data[name];
      if (raw === undefined || raw === null || raw === "") {
        if (!optional) errors += name + " required. ";
        continue;
      }
      if (typeof raw !== "string") {
        errors += name + " must be a string. ";
        continue;
      }

      let current = raw;
      let failed = false;
      for (let k = 0; k < fn.length; k++) {
        const r = fn[k](current);
        if (typeof r === "string") current = r;
        else if (!r) {
          errors += name + " validation failed at step " + k + 1;
          failed = true;
          break;
        }
      }
      if (!failed) value[name] = current;
    }

    return errors.length
      ? Err(errors)
      : Ok(value as FormValue<F>);
  };

	/** Backend: Parse JSON from the request, then validate */
	async function parseRequest(req: Request): Promise<Result<FormValue<F>>> {
		let body: unknown;
		try {
			body = await req.json();
		} catch {
			return Err("Invalid JSON");
		}
		return parseBody(body);
  };

  return {
    href,
    method,
    fields,
    render,
    parseBody,
    parseRequest,
  };
}
