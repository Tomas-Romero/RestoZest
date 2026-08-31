import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "./components/Shell";
import { fetchMe } from "./lib/api";
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

  return (
    <Shell
      user={meQuery.data.user}
      memberships={memberships}
      venueId={venueId}
      onSelectVenue={setVenueId}
      onLoggedOut={() => {
        setVenueId(null);
        queryClient.invalidateQueries({ queryKey: ["me"] });
      }}
    />
  );
}
