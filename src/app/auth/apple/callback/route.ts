import { NextResponse } from "next/server";
import { appleIdentity } from "@/lib/oauth";
import { SITE } from "@/lib/site";
import { finishSignIn } from "@/app/auth/finish";

// Apple posts the result back here as a form (response_mode=form_post).
export async function POST(req: Request) {
  const form = await req.formData();
  // Closing Apple's sheet isn't an error worth a red box: just go back.
  if (form.get("error")) return NextResponse.redirect(`${SITE.url}/login`, 303);

  const identity = await appleIdentity(form).catch(() => null);
  return finishSignIn("apple", identity);
}
