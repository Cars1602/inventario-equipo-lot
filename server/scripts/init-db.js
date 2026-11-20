import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.js';

const sql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
try {
  await pool.query(sql);
  console.log('✔ Tabla "componentes" lista');
} catch (err) {
  console.error('✘ Error:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
