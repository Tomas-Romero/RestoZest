import { Delete } from "lucide-react";
import { useEffect, useState } from "react";

const MAX_PIN = 6;
const MIN_PIN = 4;

/** Teclado numérico grande (teclas de 64px) para ingresar el PIN con una mano. */
export function PinPad({
  title,
  subtitle,
  error,
  busy,
  onSubmit,
}: {
  title: string;
  subtitle?: string;
  error?: string | null;
  busy?: boolean;
  onSubmit: (pin: string) => void;
}) {
  const [pin, setPin] = useState("");

  // Si falló, se limpia para reintentar sin tener que borrar a mano.
  useEffect(() => {
    if (error) setPin("");
  }, [error]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < MAX_PIN ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Enter" && pin.length >= MIN_PIN && !busy) onSubmit(pin);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pin, busy, onSubmit]);

  const keyClass =
    "flex h-16 items-center justify-center rounded-xl border border-border bg-background text-2xl font-medium active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";

  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-5 px-4 py-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex h-8 items-center gap-3" role="img" aria-label={`${pin.length} dígitos ingresados`}>
        {Array.from({ length: MAX_PIN }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border border-primary ${i < pin.length ? "bg-primary" : "bg-transparent"}`}
          />
        ))}
      </div>

      <p role="alert" className="min-h-5 text-center text-sm text-destructive">
        {error}
      </p>

      <div className="grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className={keyClass} disabled={busy} onClick={() => setPin((p) => (p.length < MAX_PIN ? p + d : p))}>
            {d}
          </button>
        ))}
        <button type="button" className={keyClass} aria-label="Borrar" disabled={busy} onClick={() => setPin((p) => p.slice(0, -1))}>
          <Delete className="h-6 w-6" />
        </button>
        <button type="button" className={keyClass} disabled={busy} onClick={() => setPin((p) => (p.length < MAX_PIN ? p + "0" : p))}>
          0
        </button>
        <button
          type="button"
          className="flex h-16 items-center justify-center rounded-xl bg-primary text-lg font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:opacity-40"
          disabled={busy || pin.length < MIN_PIN}
          onClick={() => onSubmit(pin)}
        >
          {busy ? "…" : "Entrar"}
        </button>
      </div>
    </div>
  );
}
