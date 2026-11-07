export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export const notFound = (what = "Not found") => new HttpError(404, what);
export const forbidden = (what = "Forbidden") => new HttpError(403, what);
export const badRequest = (what = "Bad request", details?: unknown) => new HttpError(400, what, details);
