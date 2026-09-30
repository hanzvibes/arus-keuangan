import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/auth/callback",
  "/forgot-password",
]);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PUBLIC_API_PATHS = new Set(["/api/health"]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

function redirectToLogin(request: NextRequest, reason?: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (returnTo !== "/app") loginUrl.searchParams.set("next", returnTo);
  if (reason) loginUrl.searchParams.set("error", reason);
  return NextResponse.redirect(loginUrl);
}

function trustedMutationOrigin(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return true;

  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  return origin === request.nextUrl.origin;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let response = NextResponse.next({ request });

  if (PUBLIC_API_PATHS.has(pathname) && SAFE_METHODS.has(request.method)) {
    return response;
  }

  if (pathname.startsWith("/api/") && !trustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: "Permintaan lintas situs ditolak." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const authenticated = !error && Boolean(data?.claims?.sub);

  if (authenticated && pathname === "/") {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/app";
    appUrl.search = "";
    return NextResponse.redirect(appUrl);
  }

  if (!authenticated && pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Sesi login diperlukan." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!authenticated && !isPublicPath(pathname)) {
    return redirectToLogin(request);
  }

  if (authenticated && (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password")) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/app";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
