
import { AutoRouter, json, type IRequest } from "itty-router";

import { html, isHtml, reply } from "./utils";
import { errorPage, messageFor } from "./error";

const statusOf = (err: unknown): number => {
	const s = (err as any)?.status;
	return Number.isInteger(s) && s >= 400 && s < 600 ? s : 500;
};

type RouteEntryLike = readonly [
	method: string,
	regex: RegExp,
	handlers: readonly unknown[],
	path?: string,
];
type HasRoutes = { routes: readonly RouteEntryLike[] };

/**
 * True if any route registered on this router matches the request's path.
 * Method is ignored on purpose: a wrong-method request to a known path is then
 * answered by the router that owns the path (its 404/405 shape) instead of the other one.
 */
export function ownsPath(router: HasRoutes, request: Request): boolean {
	const { pathname } = new URL(request.url);
  return router.routes.some(
    ([, regex, , path]) => path !== "*" && regex.test(pathname)
  );
};

export function createRouterHtml<R extends IRequest, A extends any[]>() {
	return AutoRouter<R, A>({
		// Handlers may return a string and get an HTML response. Anything else is JSON as before.
		format: (r: unknown) => (typeof r === "string" ? html(r) : json(r)),
		// Thrown errors: log server-side only
		catch: (err: any, req: R, ..._args: A) => {
			console.error(err);
			return errorPage(statusOf(err), req);
		},
		// Runs after AutoRouter's own missing (404) and format steps. The catch result
		// also passes through here, which is why the HTML check is needed.
		finally: [
			(res: Response, req: R, ..._args: A) =>
				res instanceof Response && res.status >= 400 && !isHtml(res)
					? errorPage(res.status, req)
					: res,
		],
	});
}

export function createRouterApi<R extends IRequest, A extends any[]>() {
	return AutoRouter<R, A>({
		missing: () => reply("Not found", 404), // same shape as handler errors
		catch: (err: any, _req: R, ..._args: A) => {
			console.error(err);
			const status = statusOf(err);
			return reply(messageFor(status), status);
		},
		// No finally needed: deliberate error replies (reply("Unauthorized", 403)) must stay as they are.
	});
}
