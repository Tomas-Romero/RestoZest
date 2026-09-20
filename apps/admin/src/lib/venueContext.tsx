import { createContext, type ReactNode, useContext } from "react";

export type VenueInfo = { venueId: string; venueName: string; role: string };

const VenueContext = createContext<VenueInfo | null>(null);

export function VenueProvider({ value, children }: { value: VenueInfo; children: ReactNode }) {
  return <VenueContext.Provider value={value}>{children}</VenueContext.Provider>;
}

export function useVenue(): VenueInfo {
  const ctx = useContext(VenueContext);
  if (!ctx) {
    throw new Error("useVenue() usado fuera de <VenueProvider>");
  }
  return ctx;
}

export function canManageCatalog(role: string): boolean {
  return role === "owner" || role === "admin";
}
