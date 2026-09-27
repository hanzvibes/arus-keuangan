import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/auth/callback",
  "/signin-with-chatgpt",
  "/signout-with-chatgpt",
  "/callback",
]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/.well-known/");
}

function redirectToLogin(request: NextRequest, reason?: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (returnTo !== "/") loginUrl.searchParams.set("next", returnTo);
  if (reason) loginUrl.searchParams.set("error", reason);
  return NextResponse.redirect(loginUrl);
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Konfigurasi autentikasi belum tersedia." },
        { status: 503 },
      );
    }
    return isPublicPath(pathname)
      ? NextResponse.next({ request })
      : redirectToLogin(request, "config");
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, publishableKey, {
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

  if (!authenticated && pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Sesi login diperlukan." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!authenticated && !isPublicPath(pathname)) {
    return redirectToLogin(request);
  }

  if (authenticated && (pathname === "/login" || pathname === "/register")) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}