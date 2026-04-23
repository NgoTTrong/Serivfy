import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default function DashboardPage({ params }: { params: { restaurantId: string } }) {
  return <DashboardClient restaurantId={params.restaurantId} />;
}
