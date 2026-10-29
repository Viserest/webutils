
import { Uuid } from "./uuid";

export type Node = Element | string | number;

export class Element {
	public name: string;
	public attributes: Record<string, string>;
	public children: Node[];
	public constructor(name: string) {
		this.name = name;
		this.attributes = {};
		this.children = [];
		return this;
	}
	/** Append to attributes */
	public attributeAppend(entries: Record<string, string>): Element {
		for (const [key, value] of Object.entries(entries)) {
			if (this.attributes[key]) {
				this.attributes[key] = this.attributes[key] + " " + value;
			}
			else {
				this.attributes[key] = value;
			}
		}
		return this;
	}
	/** Append to children */
	public childrenAppend(...children: Node[]): Element {
		this.children.push(...children);
		return this;
	}
	/** Query for a certain tag */
	public queryAll(name: string): Element[] {
		const found: Element[] = [];
		for (const child of this.children) {
			// Only search elements
			if (child instanceof Element) {
				// If child has tag name then add to found list
				if (child.name === name) found.push(child);
				// Search all of its children too
				const found_inner = child.queryAll(name);
				if (found_inner != null) found.push(...found_inner);
			}
		}
		return found;
	}
	/** Get as string */
	public toString(): string {
    const attributes = Object.entries(this.attributes)
      .map(([key, value]) => ` ${key}="${value}"`)
      .join("");
    const children = this.children.map(String).join("");
    return `<${this.name}${attributes}>${children}</${this.name}>`;
  }
}

/**
 * Short hand for Element creation:
 * ```typescript
 * new Element(tag: string)
 *   .attributeAppend({ ...attributes })
 *   .childrenAppend(...children);
 * ```
 *
 * @param name Element tag name
 * @param attributes Key/Value pairs for attributes
 * @param children List of children
 * @returns
 */
export function tag(name: string, attributes: Record<string, string>, ...children: Node[]): Element {
	let result = new Element(name);
	if (attributes) result.attributeAppend(attributes);
	result.childrenAppend(...children);
	return result;
}

/**
 * FormOptions:
 * - href: HTTP URL
 * - method: HTTP Method
 * - submit_text: The initial submit button text (Default: "Submit")
 * - message_text: The initial message paragraph text (Default: Empty string)
 */
export interface FormOptions {
	href: string,
	method: string,
	submit_text?: string,
	message_text?: string,
}

/**
 * Create Form element with:
 * 1. Message paragraph
 * 2. Input fields
 * 3. Submit button
 * 4. Automatic submit using JSON
 *
 * FormOptions:
 * - href: HTTP URL
 * - method: HTTP Method
 * - submit_text?: The initial submit button text
 * - message_text?: The initial message paragraph text (This element is updated on submit)
 *
 * @param options FormOptions
 * @param children Child Nodes
 * @returns Form Element
 */
export function form(options: FormOptions, ...children: Node[]): Element {
	// stuff
	const submit_id = Uuid.randomv4();
	const message_id = Uuid.randomv4();
	const ids: string[] = [];
	const result = tag("form", {},
		tag("p", { "id": message_id.toString() }, options.message_text || ""),
		...children
	);

	// Get all inputs or textbox
	result.queryAll("input")
		.concat(result.queryAll("textarea"))
		?.forEach((a) => {
			const id = Uuid.randomv4();
			a.attributeAppend({ "id": id.toString() });
			ids.push(id.toString());
		});

	// Add submit and script for submitting
	result.childrenAppend(
		tag("input", {
			"type": "submit",
			"id": submit_id.toString(),
			"class": "button-primary",
			"value": options.submit_text || "Submit",
		}),
		tag("script", {
			"src": "/js/form.js",
			"data-href": options.href,
			"data-method": options.method,
			"data-submit_id": submit_id.toString(),
			"data-message_id": message_id.toString(),
			"data-input_ids": JSON.stringify(ids).replaceAll("\"", "\'"),
		}),
	);
	return result;
}

/**
 * Builds a HTML table using an Array of items. The callback
 * is called on each item to produce the row as an Element.
 *
 * @param thead Array of element for the column names
 * @param table Array of items the table is built on
 * @param callback Each item's row in the table
 * @returns Table HTML Element
 */
export function table<T>(thead: Element[], table: T[], callback: (value: T) => Element): Element {
	return tag("table", {},
		tag("thead", {}, ...thead),
		tag("thead", {},
			...table.map((a) => callback(a)),
		),
	);
}
