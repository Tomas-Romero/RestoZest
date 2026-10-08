import type { Floor, Me, PosMenu, PriceList, SessionOrder } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

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
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `Error ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const pinLogin = (venueId: string, pin: string) =>
  request<{ ok: true; user: { id: string; fullName: string }; role: string }>(`/venues/${venueId}/auth/pin-login`, {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
export const fetchMe = () => request<Me>("/auth/me");
export const logout = () => request<{ ok: true }>("/auth/logout", { method: "POST" });

export const registerDevice = (venueId: string, label: string) =>
  request<{ id: string }>(`/venues/${venueId}/devices/register`, {
    method: "POST",
    body: JSON.stringify({ label, kind: "waiter" }),
  });
export const fetchFloor = (venueId: string) => request<Floor>(`/venues/${venueId}/floor`);
export const fetchPriceLists = (venueId: string) => request<PriceList[]>(`/venues/${venueId}/price-lists`);
export const fetchPosMenu = (venueId: string, priceListId: string) =>
  request<PosMenu>(`/venues/${venueId}/pos-menu?priceListId=${priceListId}`);
export const openSession = (venueId: string, tableId: string, guests: number) =>
  request<{ id: string }>(`/venues/${venueId}/tables/${tableId}/sessions`, {
    method: "POST",
    body: JSON.stringify({ guests }),
  });
export const fetchSessionOrders = (venueId: string, sessionId: string) =>
  request<SessionOrder[]>(`/venues/${venueId}/table-sessions/${sessionId}/orders`);

export const postOrderEvent = (venueId: string, orderId: string, event: object) =>
  request<{ duplicate: boolean }>(`/venues/${venueId}/orders/${orderId}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });
