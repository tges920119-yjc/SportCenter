// js/common.js
const API_BASE = ""; // 同網域

export async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...options
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }
  return res.json();
}
