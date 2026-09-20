import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router";
import { Shell } from "./components/Shell";
import { fetchMe } from "./lib/api";
import { VenueProvider } from "./lib/venueContext";
import { CatalogPage } from "./pages/CatalogPage";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { LoginPage } from "./pages/LoginPage";

export default function App() {
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe, retry: false });
  const [venueId, setVenueId] = useState<string | null>(null);

  const memberships = useMemo(() => meQuery.data?.memberships ?? [], [meQuery.data]);

  useEffect(() => {
    if (memberships.length === 1 && venueId === null) {
      setVenueId(memberships[0]!.venueId);
    }
  }, [memberships, venueId]);

  if (meQuery.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando…</div>;
  }

  if (meQuery.isError || !meQuery.data) {
    return <LoginPage onLoggedIn={() => queryClient.invalidateQueries({ queryKey: ["me"] })} />;
  }

  const currentMembership = memberships.find((m) => m.venueId === venueId);

  return (
    <Router>
      <Shell
        user={meQuery.data.user}
        memberships={memberships}
        venueId={venueId}
        onSelectVenue={setVenueId}
        onLoggedOut={() => {
          setVenueId(null);
          queryClient.invalidateQueries({ queryKey: ["me"] });
        }}
      >
        {currentMembership && (
          <VenueProvider value={currentMembership}>
            <Routes>
              <Route path="/" element={<Navigate to="/catalogo" replace />} />
              <Route path="/catalogo" element={<CatalogPage />} />
              <Route path="/ordenes" element={<ComingSoonPage />} />
              <Route path="/caja" element={<ComingSoonPage />} />
              <Route path="/usuarios" element={<ComingSoonPage />} />
              <Route path="/reportes" element={<ComingSoonPage />} />
              <Route path="*" element={<Navigate to="/catalogo" replace />} />
            </Routes>
          </VenueProvider>
        )}
      </Shell>
    </Router>
  );
}
