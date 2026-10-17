import { getHeader, type HeadersLike } from './context.js'

// Phase 13: log lines that can be followed from the platform's edge to the app. The edge gives every request an ID (request.id, also in its own log). A line an app
// writes as `[req:<id>] message` comes out of the platform's logs with that ID as its own field, so one request can be traced across both. Nothing here sends
// anything: it writes to the app's normal output, which the platform already collects.

const ID = /^[A-Za-z0-9_.:-]{1,100}$/;

/** The request's platform ID, if the platform sent one and it is well formed. */
export function requestId(request: HeadersLike | undefined): string | undefined {
  if (!request) return undefined;
  const v = getHeader(request, 'x-platform-request-id');
  return v && ID.test(v) ? v : undefined;
}

export interface RequestLogger {
  info(...parts: unknown[]): void;
  error(...parts: unknown[]): void;
  /** The ID lines are tagged with, if any. */
  readonly id: string | undefined;
}

const text = (parts: unknown[]) => parts.map((p) => (typeof p === 'string' ? p : p instanceof Error ? p.stack ?? p.message : (() => { try { return JSON.stringify(p); } catch { return String(p); } })())).join(' ');

/**
 * A logger for one request. Every line (and every line of a multi-line message) starts with `[req:<id>] `, or is written as it is when the platform sent no ID
 * (a request that did not come through it). `out` and `err` are for tests; they default to console.log and console.error.
 */
export function logger(request?: HeadersLike, out: (line: string) => void = (l) => console.log(l), err: (line: string) => void = (l) => console.error(l)): RequestLogger {
  const id = requestId(request);
  const tag = (m: string) => m.split('\n').map((l) => (id ? `[req:${id}] ${l}` : l)).join('\n');
  return { id, info: (...p) => out(tag(text(p))), error: (...p) => err(tag(text(p))) };
}
