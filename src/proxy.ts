import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Kept through the renames: it's an invisible implementation detail, and
// changing it would sign every member out for no visible gain.
const SESSION_COOKIE = "pacemates_session";

// Lightweight edge-safe gate: just confirms a valid signed session exists.
// Deeper checks (admin role, ownership) happen in the page/server-action
// itself, which has real DB access.
const PROTECTED_PREFIXES = ["/activities", "/profile", "/admin", "/photo"];

// --- No bots ---------------------------------------------------------------
//
// Welcome: search engines (so people can find the front page) and the
// link previews chat apps make when somebody shares a link.
const WELCOME_BOTS =
  /googlebot|google-inspectiontool|bingbot|duckduckbot|applebot|facebookexternalhit|facebot|twitterbot|whatsapp|slackbot|telegrambot|discordbot|linkedinbot|skypeuripreview|vercel/i;
// Turned away: scripts, scrapers, AI crawlers, SEO tools, robot browsers.
const BLOCKED_BOTS =
  /curl|wget|python|httpx|aiohttp|go-http-client|java\/|okhttp|libwww|perl|ruby|php|node-fetch|axios|undici|^node$|headless|phantomjs|selenium|puppeteer|playwright|scrapy|gpt|claude|anthropic|perplexity|ccbot|bytespider|amazonbot|meta-externalagent|cohere|diffbot|ahrefs|semrush|mj12bot|dotbot|petalbot|dataforseo|blexbot|serpstat|barkrowler|zoominfo|imagesift|timpibot|omgili|youbot|ai2bot/i;
// Anything else calling itself a bot. Only counted with a mark a real
// browser never has (a web address, "compatible;", no "Mozilla"), as some
// phones have "bot" in their model name.
const ANY_BOT = /bot|crawl|spider|scrape|slurp/i;

function isBot(ua: string): boolean {
  if (!ua.trim()) return true;
  if (WELCOME_BOTS.test(ua)) return false;
  if (BLOCKED_BOTS.test(ua)) return true;
  return ANY_BOT.test(ua) && (/https?:\/\/|compatible;/i.test(ua) || !/mozilla/i.test(ua));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // robots.txt stays open, so the rules in it can be read.
  if (pathname !== "/robots.txt" && isBot(req.headers.get("user-agent") ?? "")) {
    return new NextResponse("No bots.", { status: 403 });
  }

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!needsAuth) return NextResponse.next();

  // Where they were going, so a shared meetup link still lands on the
  // meetup once they've signed in, not on the map.
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname + req.nextUrl.search);

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(login);
  }

  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error("missing SESSION_SECRET");
    await jwtVerify(token, new TextEncoder().encode(secret));
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(login);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  // Every page and action; not the build's own files (scripts, styles,
  // fonts), which hold nothing worth scraping.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
