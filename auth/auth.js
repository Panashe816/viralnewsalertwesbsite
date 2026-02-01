// auth/auth.js
(function () {
  // ✅ CHANGE THIS to your Render backend base URL (no trailing slash)
  // Example: https://viral-news-auth-api.onrender.com
  var API_BASE = "https://viral-news-backend-3.onrender.com";

  var ACCESS_KEY = "vn_access_token";
  var REFRESH_KEY = "vn_refresh_token";

  function setTokens(access, refresh) {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  }

  function getAccessToken() {
    return localStorage.getItem(ACCESS_KEY) || "";
  }

  function getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY) || "";
  }

  function clearTokens() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  async function api(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};

    var token = getAccessToken();
    if (token) opts.headers["Authorization"] = "Bearer " + token;

    var res = await fetch(API_BASE + path, opts);

    // If access token expired, try refresh once
    if (res.status === 401 && getRefreshToken()) {
      var refreshed = await refreshAccessToken();
      if (refreshed) {
        opts.headers["Authorization"] = "Bearer " + getAccessToken();
        res = await fetch(API_BASE + path, opts);
      }
    }
    return res;
  }

  async function signup(email, password, name) {
    var res = await fetch(API_BASE + "/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password, name: name }),
    });

    if (!res.ok) {
      var txt = await safeText(res);
      throw new Error("Signup failed: " + txt);
    }

    // Some APIs return user only; some return tokens too.
    // We'll login after signup to always get tokens.
    return await res.json();
  }

  async function login(email, password) {
    var res = await fetch(API_BASE + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password }),
    });

    if (!res.ok) {
      var txt = await safeText(res);
      throw new Error("Login failed: " + txt);
    }

    var data = await res.json();
    if (data && data.access_token) {
      setTokens(data.access_token, data.refresh_token || "");
    }
    return data;
  }

  async function refreshAccessToken() {
    var refresh = getRefreshToken();
    if (!refresh) return false;

    var res = await fetch(API_BASE + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    var data = await res.json();
    if (data && data.access_token) {
      setTokens(data.access_token, data.refresh_token || refresh);
      return true;
    }
    return false;
  }

  async function me() {
    var res = await api("/auth/me", { method: "GET" });
    if (!res.ok) return null;
    return await res.json();
  }

  async function logout() {
    // optional backend logout endpoint; if you have it, call it
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (e) {}
    clearTokens();
    return true;
  }

  async function safeText(res) {
    try {
      var t = await res.text();
      return t || ("HTTP " + res.status);
    } catch (e) {
      return "HTTP " + res.status;
    }
  }

  // Expose globally
  window.VNAuth = {
    API_BASE: API_BASE,
    signup: signup,
    login: login,
    me: me,
    logout: logout,
    refreshAccessToken: refreshAccessToken,
    getAccessToken: getAccessToken,
    getRefreshToken: getRefreshToken,
    clearTokens: clearTokens,
  };
})();
