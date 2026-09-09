import { requireVerifiedUser } from "@/lib/auth";
import RunsScreen from "@/components/RunsScreen";

export default async function ActivitiesPage() {
  await requireVerifiedUser();
  return <RunsScreen />;
}
