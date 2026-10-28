
import { tag } from "./tag.js";
import { html, escape } from "./utils.js";

const TITLES: Record<number, string> = {
	400: "Bad Request",
	401: "Unauthorized",
	403: "Forbidden",
	404: "Not Found",
	405: "Method Not Allowed",
	409: "Conflict",
	413: "Payload Too Large",
	429: "Too Many Requests",
	500: "Internal Server Error",
	502: "Bad Gateway",
	503: "Service Unavailable",
};

// Responses produced by errorPage, so `finally` doesn't render them twice
export const rendered = new WeakSet<Response>();

export function errorPage(status: number, request: Request): Response {
	const url = new URL(request.url);
	const shownUrl = escape(url.origin + url.pathname); // no query string or hash
	const title = TITLES[status] ?? "Error";

	const res = html("<!DOCTYPE html>" + tag("html", { "lang": "en" },
		tag("head", {},
			tag("meta", { "charset": "utf-8" }),
			tag("meta", { "name": "viewport", "content": "width=device-width, initial-scale=1" }),
			tag("meta", { "name": "robots", "content": "noindex" }),
			tag("title", {}, status + " " + escape(title)),
			tag("style", {}, `body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh;
				display: grid; place-items: center; text-align: center; }
				h1 { font-size: 1.25rem; margin: 0 0 1rem; }
				.code { font-size: 4rem; font-weight: 700; margin: 0; }
				.url { color: #666; word-break: break-all; }`),
		),
		tag("body", {},
			tag("main", {},
				tag("h1", {}, "Something went wrong"),
				tag("p", { "class": "code" }, status),
				tag("p", {}, escape(title)),
				tag("p", { "class": "url" }, shownUrl),
			),
		),
	),
		{
			status,
			headers: {
				"cache-control": "no-store",
			}
		}
	);

	rendered.add(res);
	return res;
}
