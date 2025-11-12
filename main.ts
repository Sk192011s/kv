import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const kv = await Deno.openKv();

serve(async (req) => {
  const url = new URL(req.url);

  // ✅ Create new short link: /new?code=abc&url=https://example.com
  if (url.pathname === "/new") {
    const code = url.searchParams.get("code");
    const long = url.searchParams.get("url");

    if (!code || !long) {
      return new Response("Missing ?code= or ?url=", { status: 400 });
    }

    // Check if code already exists
    const existing = await kv.get(["shortlink", code]);
    if (existing.value) {
      return new Response(`Code already exists: ${code}`, { status: 409 });
    }

    // Save new link
    await kv.set(["shortlink", code], long);

    return new Response(
      `✅ Created new short link:\nhttps://${url.host}/${code}`,
      { headers: { "content-type": "text/plain" } },
    );
  }

  // ✅ View all links (optional)
  if (url.pathname === "/list") {
    const list = [];
    for await (const entry of kv.list({ prefix: ["shortlink"] })) {
      list.push(`${entry.key[1]} → ${entry.value}`);
    }
    return new Response(list.join("\n") || "No links yet.", {
      headers: { "content-type": "text/plain" },
    });
  }

  // ✅ Redirect short link
  const code = url.pathname.slice(1);
  if (code) {
    const res = await kv.get(["shortlink", code]);
    if (res?.value) {
      return Response.redirect(res.value as string, 302);
    }
  }

  // ✅ Home info
  return new Response(
    "🎯 Deno ShortLink Service is running!\n\nUsage:\n/new?code=abc&url=https://example.com\n/list - view all links",
    { headers: { "content-type": "text/plain" } },
  );
});
