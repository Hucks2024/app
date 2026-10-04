import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl, enabledProviders, isProvider } from "@/lib/oauth";

// /auth/apple and /auth/google: what the "Continue with …" buttons link
// to. Sets the flow cookie and hands the browser over to the provider.
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider) || !enabledProviders()[provider]) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.redirect(await authorizeUrl(provider));
}
