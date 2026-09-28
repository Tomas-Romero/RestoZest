"use client";

import { cn } from "../lib/cn";
import type { PublicMenuCategory } from "../lib/api";

export function CategoryNav({
  categories,
  activeCategoryId,
  onSelect,
}: {
  categories: PublicMenuCategory[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Categorías del menú" className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
      {categories.map((category) => (
        <a
          key={category.id}
          href={`#categoria-${category.id}`}
          onClick={() => onSelect(category.id)}
          className={cn(
            "flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            activeCategoryId === category.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-foreground hover:bg-muted",
          )}
        >
          {category.name}
        </a>
      ))}
    </nav>
  );
}
