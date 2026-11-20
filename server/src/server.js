import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const app = express();
app.use(express.json({ limit: '8mb' }));

// CORS: permite usar la API desde Expo web en desarrollo (localhost:8081)
app.use('/api', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Versión web de la app (generada con `npm run build:web` en mobile/)
const WEB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'mobile', 'dist');
const hayWeb = existsSync(path.join(WEB_DIR, 'index.html'));
if (hayWeb) app.use(express.static(WEB_DIR));

const COLS = 'id, nombre, categoria, cantidad, proyecto, (imagen IS NOT NULL) AS tiene_imagen';

class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

function validar(b, parcial = false) {
  const c = {};
  if (!parcial || b.nombre !== undefined) {
    const nombre = String(b.nombre ?? '').trim();
    if (!nombre) throw new HttpError(400, 'El nombre es obligatorio');
    c.nombre = nombre.slice(0, 150);
  }
  if (!parcial || b.categoria !== undefined) c.categoria = String(b.categoria || 'Otro').slice(0, 60);
  if (!parcial || b.cantidad !== undefined) {
    const n = Number(b.cantidad ?? 0);
    if (!Number.isInteger(n) || n < 0) throw new HttpError(400, 'La cantidad debe ser un entero >= 0');
    c.cantidad = n;
  }
  if (!parcial || b.proyecto !== undefined) c.proyecto = String(b.proyecto ?? '').trim().slice(0, 120) || null;
  if (b.imagen !== undefined) {
    if (b.imagen && !/^data:image\/[a-z+]+;base64,[A-Za-z0-9+/=\s]+$/.test(b.imagen)) {
      throw new HttpError(400, 'La imagen debe ser base64 (data:image/...;base64,...)');
    }
    c.imagen = b.imagen || null;
  }
  return c;
}

// Comprobación rápida de que la API está viva
app.get('/api/salud', (_req, res) => res.json({ ok: true, web: hayWeb }));
if (!hayWeb) app.get('/', (_req, res) => res.json({ ok: true, servicio: 'inventario-api', web: false }));

// Listado (sin imagen para que sea ligero)
app.get('/api/componentes', wrap(async (req, res) => {
  const { q, proyecto } = req.query;
  const where = [], params = [];
  if (q) { params.push(`%${q}%`); where.push(`nombre ILIKE $${params.length}`); }
  if (proyecto) { params.push(proyecto); where.push(`proyecto = $${params.length}`); }
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM componentes ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY lower(nombre)`,
    params,
  );
  res.json(rows);
}));

app.get('/api/proyectos', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT DISTINCT proyecto FROM componentes WHERE proyecto IS NOT NULL ORDER BY 1');
  res.json(rows.map((r) => r.proyecto));
}));

app.get('/api/componentes/:id', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM componentes WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw new HttpError(404, 'No encontrado');
  res.json(rows[0]);
}));

// Imagen como archivo (para <Image source={{ uri }}>)
app.get('/api/componentes/:id/imagen', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT imagen FROM componentes WHERE id = $1', [req.params.id]);
  const m = rows[0]?.imagen?.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) return res.status(404).end();
  res.type(m[1]).send(Buffer.from(m[2], 'base64'));
}));

app.post('/api/componentes', wrap(async (req, res) => {
  const c = validar(req.body);
  const cols = Object.keys(c);
  const { rows } = await pool.query(
    `INSERT INTO componentes (${cols}) VALUES (${cols.map((_, i) => '$' + (i + 1))}) RETURNING ${COLS}`,
    cols.map((k) => c[k]),
  );
  res.status(201).json(rows[0]);
}));

app.put('/api/componentes/:id', wrap(async (req, res) => {
  const c = validar(req.body, true);
  const cols = Object.keys(c);
  if (!cols.length) throw new HttpError(400, 'Nada que actualizar');
  const { rows } = await pool.query(
    `UPDATE componentes SET ${cols.map((k, i) => `${k} = $${i + 1}`)} WHERE id = $${cols.length + 1} RETURNING ${COLS}`,
    [...cols.map((k) => c[k]), req.params.id],
  );
  if (!rows[0]) throw new HttpError(404, 'No encontrado');
  res.json(rows[0]);
}));

// Sumar / restar cantidad: { delta: 1 } o { delta: -1 }
app.post('/api/componentes/:id/ajustar', wrap(async (req, res) => {
  const delta = Number(req.body.delta);
  if (!Number.isInteger(delta)) throw new HttpError(400, 'delta inválido');
  const { rows } = await pool.query(
    `UPDATE componentes SET cantidad = GREATEST(cantidad + $1, 0) WHERE id = $2 RETURNING ${COLS}`,
    [delta, req.params.id],
  );
  if (!rows[0]) throw new HttpError(404, 'No encontrado');
  res.json(rows[0]);
}));

app.delete('/api/componentes/:id', wrap(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM componentes WHERE id = $1', [req.params.id]);
  if (!rowCount) throw new HttpError(404, 'No encontrado');
  res.status(204).end();
}));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Imagen demasiado grande' });
  if (err.code === '22P02') return res.status(400).json({ error: 'ID inválido' });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Error del servidor' : err.message });
});

const PORT = process.env.PORT || 3000;
// 0.0.0.0 para que el celular pueda conectarse por la red local
app.listen(PORT, '0.0.0.0', () => console.log(`API en http://localhost:${PORT}`));
