/*
import { AutoRouter, type IRequest } from "itty-router";

import { errorPage, rendered } from "./error.js";

const isApi = (req: Request) => new URL(req.url).pathname.startsWith("/api/");

export function createRouter<R extends IRequest, A extends any[]>() {
  return AutoRouter<R, A>({
    // Thrown errors: log server-side only, never send the message or stack to the client
    catch: (err: any, request) => {
	    console.error(err);
	    const s = err?.status;
	    const status = Number.isInteger(s) && s >= 400 && s < 600 ? s : 500;
	    return isApi(request) ? reply("Internal server error", status) : errorPage(status, request);
    },
    // Runs after AutoRouter's own missing (404) and format steps,
    // so every error response ends up as the page
    finally: [
      (res: Response, request) =>
        res instanceof Response && res.status >= 400 && !rendered.has(res) && !isApi(request)
        ? errorPage(res.status, request)
        : res,
    ],
  });
}
*/
