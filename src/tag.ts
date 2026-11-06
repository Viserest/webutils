
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
export function tag(name: string, attributes?: Record<string, string>, ...children: Node[]): Element {
	let result = new Element(name);
	if (attributes) result.attributeAppend(attributes);
	result.childrenAppend(...children);
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
