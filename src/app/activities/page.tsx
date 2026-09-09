import { requireUser } from "@/lib/auth";
import RunsScreen from "@/components/RunsScreen";

export default async function ActivitiesPage() {
  const user = await requireUser();
  return <RunsScreen user={user} />;
}
