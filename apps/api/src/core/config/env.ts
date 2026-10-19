import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const candidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../../.env'),
];

for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const ENV = {
  PORT: Number(
    process.env.API_PORT ||
      (process.env.PORT &&
      process.env.PORT !== '5432' &&
      process.env.PORT !== '4200'
        ? process.env.PORT
        : 3000)
  ),
  HOST: process.env.HOST || 'localhost',
  JWT_SECRET: process.env.JWT_SECRET || 'chave_secreta_super_segura',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  DB_HOST: process.env.DB_HOST,
  DB_PORT: Number(process.env.DB_PORT || 5432),
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASS,
  DB_NAME: process.env.DB_NAME,
  DB_SSL: process.env.DB_SSL,
  DATABASE_URL: process.env.DATABASE_URL,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  AI_TEXT_MODEL: process.env.AI_TEXT_MODEL || 'openai/gpt-oss-20b',
  AI_VISION_MODEL: process.env.AI_VISION_MODEL,
};
