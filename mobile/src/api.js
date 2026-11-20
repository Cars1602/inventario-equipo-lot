import { Platform } from 'react-native';

// En la web publicada (servida por el mismo servidor) se usa la misma URL: ''
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'web' ? '' : 'http://192.168.1.10:3000');

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(API_URL + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const api = {
  listar: (q = '') => request(`/api/componentes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  proyectos: () => request('/api/proyectos'),
  obtener: (id) => request(`/api/componentes/${id}`),
  crear: (c) => request('/api/componentes', { method: 'POST', body: c }),
  actualizar: (id, c) => request(`/api/componentes/${id}`, { method: 'PUT', body: c }),
  ajustar: (id, delta) => request(`/api/componentes/${id}/ajustar`, { method: 'POST', body: { delta } }),
  eliminar: (id) => request(`/api/componentes/${id}`, { method: 'DELETE' }),
  imagenUrl: (id, v = '') => `${API_URL}/api/componentes/${id}/imagen?v=${v}`,
};
