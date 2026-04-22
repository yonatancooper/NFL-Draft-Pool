const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const signIn = (data) => request('/auth/sign-in', { method: 'POST', body: JSON.stringify(data) });
export const getProspects = () => request('/prospects');
export const getDraftOrder = () => request('/draft-order');
export const getScoringConfig = () => request('/scoring-config');
export const checkEmail = (email) => request(`/check-email?email=${encodeURIComponent(email)}`);
export const submitEntry = (data) => request('/submit', { method: 'POST', body: JSON.stringify(data) });
export const getEntry = (token) => request(`/entry/${token}`);
export const getLeaderboard = () => request('/leaderboard');
export const submitResults = (data) => request('/admin/results', { method: 'POST', body: JSON.stringify(data) });
export const getAdminStats = (password) => request(`/admin/stats?password=${encodeURIComponent(password)}`);
export const getAdminEntries = (password) => request(`/admin/entries?password=${encodeURIComponent(password)}`);
export const deleteAdminEntry = (userId, password) => request(`/admin/entries/${userId}?password=${encodeURIComponent(password)}`, { method: 'DELETE' });
export const editAdminPicks = (userId, data) => request(`/admin/entries/${userId}/picks`, { method: 'PUT', body: JSON.stringify(data) });
export const updateEntry = (token, data) => request(`/entry/${token}/edit`, { method: 'PUT', body: JSON.stringify(data) });
export const loadOwnPicks = (data) => request('/entry/load-picks', { method: 'POST', body: JSON.stringify(data) });
export const saveDraft = (data) => request('/drafts/save', { method: 'POST', body: JSON.stringify(data) });
export const loadDraft = (data) => request('/drafts/load', { method: 'POST', body: JSON.stringify(data) });
export const getLivePoller = (password) => request(`/admin/live-poller?password=${encodeURIComponent(password)}`);
export const toggleLivePoller = (password, enabled) => request('/admin/live-poller/toggle', { method: 'POST', body: JSON.stringify({ password, enabled }) });
export const confirmLivePoller = (password, overall, prospect_id) => request('/admin/live-poller/confirm', { method: 'POST', body: JSON.stringify({ password, overall, prospect_id }) });
