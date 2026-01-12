// ===== GitHub Pages Frontend Common (Token-based) =====
const API_BASE = "https://booking.novrise.org"; // 改成你的後端公開網域
const TOKEN_KEY = "sportcenter_token";
const USER_KEY  = "sportcenter_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(t) {
  if (!t) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, t);
}

function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
  catch { return null; }
}

function setUser(u) {
  if (!u) localStorage.removeItem(USER_KEY);
  else localStorage.setItem(USER_KEY, JSON.stringify(u));
}

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(API_BASE + path, { ...opts, headers });
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = body?.detail || (typeof body === "string" ? body : "Request failed");
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
}

// 取得目前登入者（token 有效才會成功）
async function refreshMe() {
  const token = getToken();
  if (!token) { setUser(null); return null; }
  try {
    const me = await api("/api/auth/me", { method: "GET" });
    setUser(me);
    return me;
  } catch {
    setToken("");
    setUser(null);
    return null;
  }
}
