import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatCents } from "@resto-zest/domain";
import { Button, Input } from "@resto-zest/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Percent, Plus } from "lucide-react";
import { useState } from "react";
import {
  type Category,
  type Product,
  createCategory,
  deleteCategory,
  fetchCategories,
  fetchProducts,
  renameCategory,
  reorderCategory,
  reorderProduct,
} from "../lib/catalogApi";
import { canManageCatalog, useVenue } from "../lib/venueContext";
import { PriceChangeSheet } from "./PriceChangeSheet";
import { ProductEditorSheet } from "./ProductEditorSheet";

export function CatalogPage() {
  const { venueId, role } = useVenue();
  const canEdit = canManageCatalog(role);
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({ queryKey: ["categories", venueId], queryFn: () => fetchCategories(venueId) });
  const productsQuery = useQuery({ queryKey: ["products", venueId], queryFn: () => fetchProducts(venueId) });

  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [priceChangeOpen, setPriceChangeOpen] = useState(false);

  const invalidateCategories = () => queryClient.invalidateQueries({ queryKey: ["categories", venueId] });
  const invalidateProducts = () => queryClient.invalidateQueries({ queryKey: ["products", venueId] });

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => createCategory(venueId, name),
    onSuccess: () => {
      invalidateCategories();
      setNewCategoryName("");
      setNewCategoryOpen(false);
    },
  });

  const renameCategoryMutation = useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) => renameCategory(venueId, categoryId, name),
    onSuccess: invalidateCategories,
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => deleteCategory(venueId, categoryId),
    onSuccess: () => {
      invalidateCategories();
      invalidateProducts();
    },
  });

  const reorderCategoryMutation = useMutation({ mutationFn: reorderCategoryFn, onSuccess: invalidateCategories });
  function reorderCategoryFn(args: { categoryId: string; position: number }) {
    return reorderCategory(venueId, args.categoryId, args.position);
  }

  const reorderProductMutation = useMutation({ mutationFn: reorderProductFn, onSuccess: invalidateProducts });
  function reorderProductFn(args: { productId: string; position: number }) {
    return reorderProduct(venueId, args.productId, args.position);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (categoriesQuery.isLoading || productsQuery.isLoading) {
    return <div className="p-8 text-muted-foreground">Cargando catálogo…</div>;
  }

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const productsByCategory = new Map<string | null, Product[]>();
  for (const product of products) {
    const key = product.categoryId;
    const list = productsByCategory.get(key) ?? [];
    list.push(product);
    productsByCategory.set(key, list);
  }
  for (const list of productsByCategory.values()) {
    list.sort((a, b) => a.position - b.position);
  }
  const uncategorized = productsByCategory.get(null) ?? [];

  function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(categories, oldIndex, newIndex);
    reordered.forEach((category, index) => {
      if (category.position !== index) {
        reorderCategoryMutation.mutate({ categoryId: category.id, position: index });
      }
    });
  }

  function handleProductDragEnd(categoryProducts: Product[]) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = categoryProducts.findIndex((p) => p.id === active.id);
      const newIndex = categoryProducts.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(categoryProducts, oldIndex, newIndex);
      reordered.forEach((product, index) => {
        if (product.position !== index) {
          reorderProductMutation.mutate({ productId: product.id, position: index });
        }
      });
    };
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Catálogo</h1>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPriceChangeOpen(true)}>
              <Percent className="mr-1 h-4 w-4" /> Remarcación masiva
            </Button>
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="mr-1 h-4 w-4" /> Producto
            </Button>
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-6">
            {categories.map((category) => (
              <CategoryBlock
                key={category.id}
                category={category}
                products={productsByCategory.get(category.id) ?? []}
                canEdit={canEdit}
                onProductClick={setEditing}
                onRename={(name) => renameCategoryMutation.mutate({ categoryId: category.id, name })}
                onDelete={() => {
                  if (confirm(`¿Borrar la categoría "${category.name}"?`)) {
                    deleteCategoryMutation.mutate(category.id);
                  }
                }}
                onProductDragEnd={handleProductDragEnd(productsByCategory.get(category.id) ?? [])}
                sensors={sensors}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {uncategorized.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Sin categoría</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProductDragEnd(uncategorized)}>
            <SortableContext items={uncategorized.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col rounded-md border border-border">
                {uncategorized.map((product) => (
                  <SortableProductRow key={product.id} product={product} onClick={() => setEditing(product)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {canEdit && (
        <div className="mt-6">
          {newCategoryOpen ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newCategoryName.trim()) createCategoryMutation.mutate(newCategoryName.trim());
              }}
            >
              <Input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nombre de la categoría"
              />
              <Button type="submit" disabled={createCategoryMutation.isPending}>
                Crear
              </Button>
              <Button type="button" variant="outline" onClick={() => setNewCategoryOpen(false)}>
                Cancelar
              </Button>
            </form>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setNewCategoryOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Categoría
            </Button>
          )}
        </div>
      )}

      {editing && (
        <ProductEditorSheet
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}

      {priceChangeOpen && <PriceChangeSheet categories={categories} onClose={() => setPriceChangeOpen(false)} />}
    </div>
  );
}

function CategoryBlock({
  category,
  products,
  canEdit,
  onProductClick,
  onRename,
  onDelete,
  onProductDragEnd,
  sensors,
}: {
  category: Category;
  products: Product[];
  canEdit: boolean;
  onProductClick: (product: Product) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onProductDragEnd: (event: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(category.name);

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div className="mb-2 flex items-center gap-2">
        {canEdit && (
          <button type="button" className="cursor-grab touch-none text-muted-foreground" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        {editingName ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onRename(name);
              setEditingName(false);
            }}
          >
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
            <Button type="submit" size="sm">
              Guardar
            </Button>
          </form>
        ) : (
          <>
            <h2
              className={`text-sm font-semibold ${canEdit ? "cursor-pointer hover:underline" : ""}`}
              onClick={() => canEdit && setEditingName(true)}
            >
              {category.name}
            </h2>
            {canEdit && (
              <button type="button" onClick={onDelete} className="ml-auto text-xs text-muted-foreground hover:text-destructive">
                Borrar
              </button>
            )}
          </>
        )}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onProductDragEnd}>
        <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col rounded-md border border-border">
            {products.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Sin productos todavía.</p>
            ) : (
              products.map((product) => (
                <SortableProductRow key={product.id} product={product} onClick={() => onProductClick(product)} />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableProductRow({ product, onClick }: { product: Product; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: product.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 border-b border-border p-3 last:border-b-0"
    >
      <button type="button" className="cursor-grab touch-none text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onClick} className="flex flex-1 items-center justify-between text-left text-sm hover:underline">
        <span className={product.available ? "" : "text-muted-foreground line-through"}>{product.name}</span>
        <span className="tabular-nums">{formatCents(product.basePriceCents)}</span>
      </button>
    </div>
  );
}
