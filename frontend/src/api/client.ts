const BASE_URL = "";

function withAdminHeader(headers: Record<string, string> = {}) {
  try {
    const adminPassword = localStorage.getItem("asspp_admin_password") || "";
    if (adminPassword) {
      return { ...headers, "x-admin-password": adminPassword };
    }
  } catch {
    // ignore (e.g., SSR)
  }
  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: withAdminHeader(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: withAdminHeader({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: withAdminHeader(),
  });
  if (!res.ok) throw new Error(await res.text());
}
