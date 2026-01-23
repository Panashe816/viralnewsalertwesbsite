const API_BASE = "https://YOUR-RENDER-URL.onrender.com";

function setTokens({ access_token, refresh_token }) {
  localStorage.setItem("access_token", access_token);
  localStorage.setItem("refresh_token", refresh_token);
}

function getAccessToken() {
  return localStorage.getItem("access_token");
}

function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

async function refreshTokens() {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });

  if (!res.ok) return false;
  const data = await res.json();
  setTokens(data);
  return true;
}

async function apiFetch(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};

  const access = getAccessToken();
  if (access) headers["Authorization"] = `Bearer ${access}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // If access expired, refresh once then retry
  if (res.status === 401) {
    const ok = await refreshTokens();
    if (ok) {
      const newAccess = getAccessToken();
      headers["Authorization"] = `Bearer ${newAccess}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  return res;
}

// Login example
async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Login failed");

  setTokens(data);
  return data;
}

// Logout example (revokes refresh token)
async function logout() {
  const refresh_token = getRefreshToken();
  if (refresh_token) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
  }
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}
