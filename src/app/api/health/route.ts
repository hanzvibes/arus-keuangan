const healthHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { status: "ok", service: "arus" },
    { status: 200, headers: healthHeaders },
  );
}

export async function HEAD() {
  return new Response(null, { status: 200, headers: healthHeaders });
}
