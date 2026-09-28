"use client";

import { formatCents } from "@resto-zest/domain";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef } from "react";
import type { PublicMenuProduct } from "../lib/api";

export function ProductDetailSheet({ product, onClose }: { product: PublicMenuProduct | null; onClose: () => void }) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!product) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [product, onClose]);

  return (
    <AnimatePresence>
      {product && (
        <>
          <motion.div
            key="overlay"
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-background p-4 shadow-lg"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-lg font-semibold">
                {product.name}
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                ✕
              </button>
            </div>

            {product.description && <p className="mt-2 text-muted-foreground">{product.description}</p>}
            <p className="mt-3 text-xl font-semibold tabular-nums">{formatCents(product.basePriceCents)}</p>

            {product.variants.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">Presentaciones</p>
                <ul className="flex flex-col gap-1">
                  {product.variants.map((variant) => (
                    <li key={variant.id} className="flex justify-between text-sm">
                      <span>{variant.name}</span>
                      <span className="tabular-nums">{formatCents(product.basePriceCents + variant.priceDeltaCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {product.modifierGroups.map((group) => (
              <div key={group.id} className="mt-4">
                <p className="mb-2 text-sm font-medium">{group.name}</p>
                <ul className="flex flex-col gap-1">
                  {group.modifiers.map((modifier) => (
                    <li key={modifier.id} className="flex justify-between text-sm text-muted-foreground">
                      <span>{modifier.name}</span>
                      {modifier.priceDeltaCents !== 0 && (
                        <span className="tabular-nums">+{formatCents(modifier.priceDeltaCents)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {product.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-1 text-xs uppercase text-muted-foreground">
                    {tag.replace("_", " ")}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
