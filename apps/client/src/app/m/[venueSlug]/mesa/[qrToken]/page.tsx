import { notFound } from "next/navigation";
import { MenuView } from "../../../../../components/MenuView";
import { fetchPublicMenuForTable } from "../../../../../lib/api";

export const revalidate = 60;

export default async function TableMenuPage({
  params,
}: {
  params: Promise<{ venueSlug: string; qrToken: string }>;
}) {
  const { venueSlug, qrToken } = await params;
  const data = await fetchPublicMenuForTable(venueSlug, qrToken);
  if (!data) {
    notFound();
  }
  return <MenuView menu={data.menu} venueName={data.venue.name} tableCode={data.table.code} />;
}
