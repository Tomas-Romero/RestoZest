"use client";

import { useCallback, useMemo, useState } from "react";
import type { PublicMenu, PublicMenuProduct } from "../lib/api";
import { CategoryNav } from "./CategoryNav";
import { ProductCard } from "./ProductCard";
import { ProductDetailSheet } from "./ProductDetailSheet";
import { SearchBar } from "./SearchBar";

export function MenuView({
  menu,
  venueName,
  tableCode,
}: {
  menu: PublicMenu;
  venueName: string;
  tableCode?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(menu.categories[0]?.id ?? null);
  const [selectedProduct, setSelectedProduct] = useState<PublicMenuProduct | null>(null);

  const handleQueryChange = useCallback((value: string) => setQuery(value), []);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return menu.products.filter((product) => {
      if (activeTag && !product.tags.includes(activeTag)) return false;
      if (!normalizedQuery) return true;
      return (
        product.name.toLowerCase().includes(normalizedQuery) ||
        (product.description?.toLowerCase().includes(normalizedQuery) ?? false)
      );
    });
  }, [menu.products, query, activeTag]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, PublicMenuProduct[]>();
    for (const product of filteredProducts) {
      if (!product.categoryId) continue;
      const list = map.get(product.categoryId) ?? [];
      list.push(product);
      map.set(product.categoryId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [filteredProducts]);

  const visibleCategories = menu.categories.filter((category) => (productsByCategory.get(category.id)?.length ?? 0) > 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold">{venueName}</h1>
          {tableCode && <p className="text-sm text-muted-foreground">Mesa {tableCode} · solo consulta</p>}
        </div>
        <SearchBar onQueryChange={handleQueryChange} activeTag={activeTag} onTagChange={setActiveTag} />
        <CategoryNav categories={visibleCategories} activeCategoryId={activeCategoryId} onSelect={setActiveCategoryId} />
      </header>

      <main className="flex flex-col gap-8 px-4 py-6">
        {visibleCategories.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">No encontramos platos que coincidan con la búsqueda.</p>
        )}
        {visibleCategories.map((category) => (
          <section key={category.id} id={`categoria-${category.id}`} aria-label={category.name} className="scroll-mt-32">
            <h2 className="mb-3 text-base font-semibold">{category.name}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(productsByCategory.get(category.id) ?? []).map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} onClick={() => setSelectedProduct(product)} />
              ))}
            </div>
          </section>
        ))}
      </main>

      <ProductDetailSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </div>
  );
}
