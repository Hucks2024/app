import { redirect } from "next/navigation";

// There's one way in now, for new and returning members alike, and it
// works out which you are from your email. Old /signup links
// still land somewhere useful.
export default function SignupPage() {
  redirect("/login");
}
