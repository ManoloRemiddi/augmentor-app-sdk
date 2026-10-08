// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
import {DatabaseSync} from 'node:sqlite';
import {chmodSync} from 'node:fs';

/** Owner-only SQLite file with WAL and a busy timeout, shared by the SDK's optional stores. */
export function openDatabase(file, schema) {
  const db = new DatabaseSync(file);
  if (file !== ':memory:') chmodSync(file, 0o600);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;' + schema);
  return db;
}

export const parseJson = value => value === null || value === undefined ? null : JSON.parse(value);
export const toJson = value => value === undefined ? null : JSON.stringify(value);

/** Bounded limit/offset for list queries. */
export function page({limit = 50, offset = 0} = {}) {
  return {limit: Math.max(1, Math.min(500, Number.parseInt(limit, 10) || 50)), offset: Math.max(0, Number.parseInt(offset, 10) || 0)};
}
