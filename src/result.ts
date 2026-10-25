
//
// Nice return types
//

export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export type Option<T> =
  | { some: true; value: T }
  | { some: false };

export function Some<T>(value: T): Option<T> {
  return { some: true, value };
}

export function None(): Option<never> {
  return { some: false };
}
