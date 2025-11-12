import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const kv = await Deno.openKv();

// Helper: random short code (6 chars, a-z0-9)
function generateCode(length = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

serve(async (req) => {
  const url = new URL(req.url);

  // ✅ Create new short link (auto code)
  if (url.pathname === "/new") {
    const long = url.searchParams.get("url");
    if (!long) return new Response("Missing ?url=", { status: 400 });

    // Generate unique code
    let code: string;
    let tries = 0;
    do {
      code = generateCode(6);
      const existing = await kv.get(["shortlink", code]);
      if (!existing.value) break;
      tries++;
    } while (tries < 10);

    await kv.set(["shortlink", code], long);

    return new Response(
      `✅ Created new short link:\nhttps://${url.host}/${code}`,
      { headers: { "content-type": "text/plain" } }
    );
  }

  // ✅ List all
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

  // ✅ Homepage
  return new Response(
    "🎯 Deno ShortLink Service is running!\n\nUsage:\n/new?url=https://example.com\n/list - view all links",
    { headers: { "content-type": "text/plain" } }
  );
});
