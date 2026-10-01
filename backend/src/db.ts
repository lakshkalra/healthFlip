import { Pool } from 'pg';

export function createDatabasePool(connectionString?: string): Pool | null {
  if (!connectionString) {
    return null;
  }

  return new Pool({ connectionString });
}
