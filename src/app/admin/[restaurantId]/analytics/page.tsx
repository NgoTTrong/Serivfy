import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default function AnalyticsPage({ params }: { params: { restaurantId: string } }) {
  return <AnalyticsClient restaurantId={params.restaurantId} />;
}
