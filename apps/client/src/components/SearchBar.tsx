"use client";

import { useEffect, useState } from "react";
import { cn } from "../lib/cn";

const TAGS = [
  { value: "sin_tacc", label: "Sin TACC" },
  { value: "vegano", label: "Vegano" },
  { value: "picante", label: "Picante" },
] as const;

export function SearchBar({
  onQueryChange,
  activeTag,
  onTagChange,
}: {
  onQueryChange: (query: string) => void;
  activeTag: string | null;
  onTagChange: (tag: string | null) => void;
}) {
  const [draft, setDraft] = useState("");

  // Debounce: evita recalcular el filtro en cada tecla.
  useEffect(() => {
    const id = setTimeout(() => onQueryChange(draft), 250);
    return () => clearTimeout(id);
  }, [draft, onQueryChange]);

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Buscar en el menú…"
        aria-label="Buscar en el menú"
        className={cn(
          "h-11 w-full rounded-full border border-border bg-muted px-4 text-sm text-foreground",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
      />
      <div role="group" aria-label="Filtrar por etiqueta" className="flex gap-2">
        {TAGS.map((tag) => (
          <button
            key={tag.value}
            type="button"
            aria-pressed={activeTag === tag.value}
            onClick={() => onTagChange(activeTag === tag.value ? null : tag.value)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeTag === tag.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
}
