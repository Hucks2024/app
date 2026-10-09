import { redirect } from "next/navigation";
import { getCurrentUser, isPaidUp } from "@/lib/auth";
import RunsScreen from "@/components/RunsScreen";
import Landing from "@/components/Landing";

export default async function HomePage() {
  const user = await getCurrentUser();

  // Members see the map right here on "/", no marketing copy, no extra
  // click. Everyone else gets the front door.
  if (user) {
    if (!isPaidUp(user)) redirect("/subscribe");
    return <RunsScreen user={user} />;
  }

  return <Landing />;
}
