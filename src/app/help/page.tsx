import { redirect } from "next/navigation";

// Help is called Info now. Old links (and bookmarks) carry on to it.
export default function HelpPage() {
  redirect("/info");
}
