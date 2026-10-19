import { Pool, PoolConfig } from 'pg';
import { ENV } from './env';

const host = (ENV.DB_HOST || '').toLowerCase();
const connStr = (ENV.DATABASE_URL || '').toLowerCase();

const isNeon = host.includes('neon.tech') || connStr.includes('neon.tech');
const isLocal =
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host === 'postgres' ||
  host === '';

// Neon e provedores de nuvem sempre exigem SSL incondicionalmente
const useSsl =
  isNeon ||
  process.env.DB_SSL === 'true' ||
  (!isLocal && process.env.DB_SSL !== 'false');

const sslOption = useSsl ? { rejectUnauthorized: false } : false;

const poolConfig: PoolConfig = ENV.DATABASE_URL
  ? {
      connectionString: ENV.DATABASE_URL,
      ssl: sslOption,
    }
  : {
      host: ENV.DB_HOST,
      port: ENV.DB_PORT,
      user: ENV.DB_USER,
      password: ENV.DB_PASS,
      database: ENV.DB_NAME,
      ssl: sslOption,
    };

export const pool = new Pool(poolConfig);

