// Identidad del dispositivo: a qué local pertenece, su id registrado en la API
// y su reloj lógico (lamport). Es el "enrolamiento liviano" de Fase 3; el
// enrolamiento firmado por el hub llega en Fase 5.
const KEYS = { venue: "rz.venueId", device: "rz.deviceId", lamport: "rz.lamport" } as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // modo privado / storage bloqueado: la app sigue, solo pierde la memoria entre recargas
  }
}

/** Permite configurar el local una sola vez con un link: /?venue=<id> */
export function captureVenueFromUrl() {
  const venue = new URLSearchParams(window.location.search).get("venue");
  if (venue) {
    write(KEYS.venue, venue);
    window.history.replaceState({}, "", window.location.pathname);
  }
}

export const getVenueId = () => read(KEYS.venue);
export const setVenueId = (id: string) => write(KEYS.venue, id);
export const getDeviceId = () => read(KEYS.device);
export const setDeviceId = (id: string) => write(KEYS.device, id);
export const getLamport = () => Number(read(KEYS.lamport) ?? "1");
export const setLamport = (value: number) => write(KEYS.lamport, String(value));

export function forgetDevice() {
  write(KEYS.venue, null);
  write(KEYS.device, null);
  write(KEYS.lamport, null);
}
