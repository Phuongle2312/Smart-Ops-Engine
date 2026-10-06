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

// Gửi multipart (ảnh) — không tự đặt Content-Type để trình duyệt tự thêm boundary
async function upload(path, formData) {
  const res = await fetch(`${BASE}/api${path}`, { method: 'POST', body: formData });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.message || data.error || msg;
    } catch { /* body rỗng */ }
    throw new Error(msg);
  }
  return res.json();
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
  // Chẩn đoán lỗi từ ảnh (AI) — trả 202, kết quả xuất hiện ở danh sách sự cố
  diagnoseImage: (file, nodeId, note) => {
    const form = new FormData();
    form.append('file', file);
    form.append('nodeId', nodeId);
    if (note) form.append('note', note);
    return upload('/diagnose', form);
  },
  // AI agent: chạy đồng bộ (có thể mất vài chục giây), trả kết luận + trace từng bước; ảnh tùy chọn
  agentDiagnose: (file, nodeId, note) => {
    const form = new FormData();
    if (file) form.append('file', file);
    form.append('nodeId', nodeId);
    if (note) form.append('note', note);
    return upload('/agent/diagnose', form);
  },
  sendAiFeedback: (incidentId, data) => request('POST', `/incidents/${incidentId}/ai-feedback`, data),
  getOwners: (nodeId) => request('GET', `/nodes/${nodeId}/owners`),
  addOwner: (nodeId, data) => request('POST', `/nodes/${nodeId}/owners`, data),
  deleteOwner: (ownerId) => request('DELETE', `/owners/${ownerId}`),
};
