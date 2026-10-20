import type { Id, TableNames } from "../../convex/_generated/dataModel";

/**
 * Convex document ids are URL-safe base32 strings. Route params that cannot
 * be one ("xyz") must not be sent to `v.id(...)` queries.
 */
const DOCUMENT_ID = /^[A-Za-z0-9_-]{8,128}$/;

export function asTableId<Table extends TableNames>(
  value: string,
): Id<Table> | null {
  return DOCUMENT_ID.test(value) ? (value as Id<Table>) : null;
}
