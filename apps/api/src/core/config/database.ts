import { Pool, PoolConfig } from 'pg';
import { ENV } from './env';

const isNeon =
  (ENV.DB_HOST && ENV.DB_HOST.includes('neon.tech')) ||
  (ENV.DATABASE_URL && ENV.DATABASE_URL.includes('neon.tech'));
const useSsl =
  process.env.DB_SSL === 'true' ||
  (process.env.DB_SSL !== 'false' && Boolean(isNeon));
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

