import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeDestination(requestUrl: URL) {
  const requested = requestUrl.searchParams.get("next") || "/app";
  const candidate = new URL(requested, requestUrl.origin);
  if (candidate.origin !== requestUrl.origin) return new URL("/app", requestUrl.origin);
  return candidate;
}

function callbackError(requestUrl: URL) {
  return safeDestination(requestUrl).pathname === "/update-password" ? "recovery" : "verification";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const flowId = requestUrl.searchParams.get("sb_flow_id");

  if (!code) {
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("error", callbackError(requestUrl));
    return NextResponse.redirect(login);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );

  if (error) {
    console.error("Supabase email callback failed", error);
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("error", callbackError(requestUrl));
    return NextResponse.redirect(login);
  }

  return NextResponse.redirect(safeDestination(requestUrl));
}
