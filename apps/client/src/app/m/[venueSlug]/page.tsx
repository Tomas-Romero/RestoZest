import { notFound } from "next/navigation";
import { MenuView } from "../../../components/MenuView";
import { fetchPublicMenu } from "../../../lib/api";

export const revalidate = 60;

export default async function VenueMenuPage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params;
  const data = await fetchPublicMenu(venueSlug);
  if (!data) {
    notFound();
  }
  return <MenuView menu={data.menu} venueName={data.venue.name} />;
}
