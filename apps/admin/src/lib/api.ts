const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new ApiError(res.status, body.error ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type Membership = { venueId: string; venueName: string; role: string };

export type Me = {
  user: { id: string; fullName: string; email: string | null };
  tenantId: string;
  memberships: Membership[];
};

export function fetchMe(): Promise<Me> {
  return request<Me>("/auth/me");
}

export function login(email: string, password: string): Promise<{ ok: true }> {
  return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function logout(): Promise<{ ok: true }> {
  return request("/auth/logout", { method: "POST" });
}
