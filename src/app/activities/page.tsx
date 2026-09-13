import { requireMember } from "@/lib/auth";
import RunsScreen from "@/components/RunsScreen";

export default async function ActivitiesPage() {
  const user = await requireMember();
  return <RunsScreen user={user} />;
}
