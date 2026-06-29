import pg from 'pg';
import { config } from './config.js';

/** Pool único de conexão com o PostgreSQL/Supabase. */
export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
