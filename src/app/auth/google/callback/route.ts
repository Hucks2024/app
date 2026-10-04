import { NextResponse, type NextRequest } from "next/server";
import { googleIdentity } from "@/lib/oauth";
import { SITE } from "@/lib/site";
import { finishSignIn } from "@/app/auth/finish";

// Google sends the browser back here with ?code=…&state=…
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return NextResponse.redirect(`${SITE.url}/login`, 303);

  const identity = await googleIdentity(params).catch(() => null);
  return finishSignIn("google", identity);
}
