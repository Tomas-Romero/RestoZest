import { Button } from "@resto-zest/ui";
import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { NavLink } from "react-router";
import type { Membership } from "../lib/api";
import { logout } from "../lib/api";

// Basado en la matriz de permisos de docs/plan/07-seguridad.md. Solo dueño y
// admin llegan a este panel (login email+password); cajero/mozo/cocina
// entran por PIN en el plano operativo — esta lista queda genérica para
// cuando haya membership con otros roles visibles acá igual.
const SECTIONS = [
  { key: "catalogo", label: "Catálogo", roles: ["owner", "admin"] },
  { key: "ordenes", label: "Órdenes", roles: ["owner", "admin", "cashier", "waiter"] },
  { key: "caja", label: "Caja", roles: ["owner", "admin", "cashier"] },
  { key: "usuarios", label: "Usuarios y dispositivos", roles: ["owner", "admin"] },
  { key: "reportes", label: "Reportes", roles: ["owner"] },
] as const;

type ShellProps = {
  user: { fullName: string; email: string | null };
  memberships: Membership[];
  venueId: string | null;
  onSelectVenue: (venueId: string) => void;
  onLoggedOut: () => void;
  children: ReactNode;
};

export function Shell({ user, memberships, venueId, onSelectVenue, onLoggedOut, children }: ShellProps) {
  const logoutMutation = useMutation({ mutationFn: logout, onSuccess: onLoggedOut });
  const currentMembership = memberships.find((m) => m.venueId === venueId);

  if (memberships.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center text-muted-foreground">
        Tu usuario no tiene ningún local asignado todavía.
      </div>
    );
  }

  if (!currentMembership) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Elegí un local:</p>
          {memberships.map((m) => (
            <Button key={m.venueId} variant="outline" onClick={() => onSelectVenue(m.venueId)}>
              {m.venueName}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const visibleSections = SECTIONS.filter((s) => (s.roles as readonly string[]).includes(currentMembership.role));

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-border p-4">
        <div>
          <p className="mb-6 text-lg font-semibold">Resto Zest</p>
          <nav className="flex flex-col gap-1">
            {visibleSections.map((s) => (
              <NavLink
                key={s.key}
                to={`/${s.key}`}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${isActive ? "bg-muted font-medium" : ""}`
                }
              >
                {s.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
          <div>
            <p className="font-medium">{user.fullName}</p>
            <p className="text-muted-foreground">
              {currentMembership.venueName} · {currentMembership.role}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => logoutMutation.mutate()}>
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
