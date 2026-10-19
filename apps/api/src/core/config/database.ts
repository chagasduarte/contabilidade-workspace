import { Pool, PoolConfig } from 'pg';
import { ENV } from './env';

const poolConfig: PoolConfig = ENV.DATABASE_URL
  ? {
      connectionString: ENV.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    }
  : {
      host: ENV.DB_HOST,
      port: ENV.DB_PORT,
      user: ENV.DB_USER,
      password: ENV.DB_PASS,
      database: ENV.DB_NAME,
      ssl: {
        rejectUnauthorized: false,
      },
    };

export const pool = new Pool(poolConfig);

