import { requireActiveMember } from "@/lib/auth";
import RunsScreen from "@/components/RunsScreen";

export default async function ActivitiesPage() {
  await requireActiveMember();
  return <RunsScreen />;
}
