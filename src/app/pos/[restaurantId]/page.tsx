import PosGrid from "./PosGrid";

export const dynamic = "force-dynamic";

export default function PosPage({ params }: { params: { restaurantId: string } }) {
  return <PosGrid restaurantId={params.restaurantId} />;
}
