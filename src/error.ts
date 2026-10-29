
import { tag } from "./tag";
import { html, escape } from "./utils";

/** Generic, client-safe messages */
export const messages: Record<number, string> = {
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
export function messageFor(status: number): string {
  return messages[status] ?? (status >= 500 ? "Internal server error" : "Request failed");
}

// Responses produced by errorPage, so `finally` doesn't render them twice
export const rendered = new WeakSet<Response>();

export function errorPage(status: number, request: Request): Response {
  const url = new URL(request.url);

	// dont show query string or hash
	const shownUrl = escape(url.origin + url.pathname);

	const res = html("<!DOCTYPE html>" + tag("html", { "lang": "en" },
		tag("head", {},
			tag("meta", { "charset": "utf-8" }),
			tag("meta", { "name": "viewport", "content": "width=device-width, initial-scale=1" }),
			tag("meta", { "name": "robots", "content": "noindex" }),
			tag("title", {}, status + " " + messageFor(status)),
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
				tag("p", {}, messageFor(status)),
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
