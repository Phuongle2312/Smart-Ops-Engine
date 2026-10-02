// Client gọi backend v1 (Spring Boot). Dev: Vite proxy /api -> http://localhost:8080
const BASE = import.meta.env.VITE_API_URL ?? '';

async function request(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.message || data.error || msg;
    } catch { /* body rỗng */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  getNodes: () => request('GET', '/nodes'),
  createNode: (data) => request('POST', '/nodes', data),
  updateNode: (id, data) => request('PUT', `/nodes/${id}`, data),
  deleteNode: (id) => request('DELETE', `/nodes/${id}`),
  toggleNode: (id) => request('PUT', `/nodes/${id}/toggle-active`),
  checkNode: (id) => request('POST', `/nodes/${id}/check-now`),
  checkAll: () => request('POST', '/check-now'),
  getMetrics: (id, range) => request('GET', `/nodes/${id}/metrics?range=${range}`),
  getIncidents: () => request('GET', '/incidents'),
  resolveIncident: (id, resolutionAction) => request('PUT', `/incidents/${id}/resolve`, { resolutionAction }),
  acknowledgeIncident: (id) => request('PUT', `/incidents/${id}/acknowledge`),
};
