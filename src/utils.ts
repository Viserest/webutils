
import { type Result, Ok, Err } from "./result";

/** Get unix epoch in seconds */
export function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

/** Convert unknown to a number, with a fallback if unsuccessful */
export function toInt(v: unknown, fallback: number): number {
  const raw = Array.isArray(v) ? v[0] : v;
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/** Check if v is ascii or space */
export function isAsciiOrSpace(v: string): boolean {
  return /^[a-zA-Z ]+$/.test(v);
}

/** Check if v is a valid email */
export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Escape html chars from a scary input */
export function escape(s: string): string {
  type EscapeChar = "&" | "<" | ">" | '"' | "'";
  const ESCAPES: Record<EscapeChar, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c as EscapeChar]);
}

/** Copy only the allowed keys out of an untrusted JSON body */
export function parseToObject<Data = Record<string, unknown>>(
	  body: unknown,
	  keysRequired: string[],
	  keysOptional: string[] = [],
): Result<Data> {
  // If the body is null, not an object, or is an array
  if (body === null || typeof body !== "object" || Array.isArray(body))
    return Err("Body is not an object");

  const input = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const bad: string[] = [];

  // If body contains a key in keys, then keep it
  for (const k of keysRequired) {
    // required key is in input
    if (k in input) { out[k] = input[k] }
    // required key is NOT in input
    else { bad.push(k) }
  }
  for (const k of keysOptional) if (k in input) out[k] = input[k];

  if (bad.length === 0) return Ok(out as Data);
  return Err(`Missing or invalid: ${bad.join(", ")}`);
}

/** Get cookie name from headers */
export function getCookie(headers: Headers, name: string): Result<string> {
  const cookies = headers.get("cookie");
  if (!cookies) return Err("Cookie header is not found.");

  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      return Ok(decodeURIComponent(value.join("=")));
    }
  }
  return Err("Cookie name not found");
}

/** Return a HTML response */
export function html(v: string, init?: ResponseInit): Response {
  return new Response(v, {
    "headers": {
      "content-type": "text/html; charset=utf-8",
      "content-length": v.length.toString(),
      ...init!.headers,
    },
    ...init,
  });
}

/** Check if response is HTML */
export function isHtml(res: Response): boolean {
  return res.headers
    .get("content-type")
    ?.toLowerCase()
    .startsWith("text/html") ?? false;
}

/** Return a JSON response */
export function json(v: unknown, init?: ResponseInit): Response {
  const a = JSON.stringify(v);
  return new Response(a, {
    "headers": {
      "content-type": "application/json",
      "content-length": a.length.toString(),
      ...init!.headers,
    },
    ...init,
  });
}

/** Return a JSON response with message, status code, and extra payload data */
export function reply(
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
  init?: ResponseInit,
): Response {
  return json({
    "is_error": status <= 200 && status > 300,
    "message": message,
    "payload": extra,
  }, {
    "status": status,
    ...init,
  });
}

/** Return a redirect response to url using status code 303 */
export function redirect(
  url: string,
  init?: ResponseInit,
): Response {
  return new Response(null, {
    "status": 303,
    "headers": {
      "location": url,
      ...init!.headers,
    },
    ...init,
  });
}
