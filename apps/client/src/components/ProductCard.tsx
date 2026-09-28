"use client";

import { formatCents } from "@resto-zest/domain";
import { motion } from "motion/react";
import Image from "next/image";
import type { PublicMenuProduct } from "../lib/api";

const KIND_EMOJI: Record<string, string> = { drink: "🥤", combo: "🍱", food: "🍽️" };

export function ProductCard({
  product,
  index,
  onClick,
}: {
  product: PublicMenuProduct;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.25 }}
      className="flex min-h-11 items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {product.imageUrl ? (
        <Image
          src={product.imageUrl}
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-2xl"
          aria-hidden="true"
        >
          {KIND_EMOJI[product.kind] ?? "🍽️"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{product.name}</p>
        {product.description && <p className="truncate text-sm text-muted-foreground">{product.description}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold tabular-nums">{formatCents(product.basePriceCents)}</span>
          {product.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
              {tag.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>
    </motion.button>
  );
}
