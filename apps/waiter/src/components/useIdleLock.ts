import { useEffect, useState } from "react";

/**
 * Auto-bloqueo por inactividad (07-seguridad.md: la tablet pasa de mano en
 * mano). Es solo de UI: la sesión del servidor sigue viva, pero la pantalla
 * pide el PIN de nuevo. No descarta el carrito.
 */
export function useIdleLock(enabled: boolean, ms = 90_000) {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!enabled || locked) return;
    let timer = window.setTimeout(() => setLocked(true), ms);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), ms);
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    for (const e of events) window.addEventListener(e, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, reset);
    };
  }, [enabled, locked, ms]);

  return { locked, unlock: () => setLocked(false), lock: () => setLocked(true) };
}
