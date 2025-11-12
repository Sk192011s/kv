import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const kv = await Deno.openKv();

function generateCode(length = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Simple HTML page
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Deno ShortLink Generator</title>
<style>
body { font-family: sans-serif; max-width: 600px; margin: 50px auto; }
input { width: 80%; padding: 8px; }
button { padding: 8px 12px; }
#result { margin-top: 20px; }
</style>
</head>
<body>
<h1>Deno ShortLink Generator</h1>
<input id="url" type="text" placeholder="Enter your URL here"/>
<button id="generate">Generate</button>
<div id="result"></div>

<script>
document.getElementById("generate").onclick = async () => {
  const url = document.getElementById("url").value;
  if(!url) return alert("Enter URL");

  const resp = await fetch('/new?url=' + encodeURIComponent(url));
  const text = await resp.text();
  const out = document.getElementById("result");
  out.innerHTML = text + ' <button onclick="copyText()">Copy</button>';
  window.copyText = () => {
    navigator.clipboard.writeText(text).then(()=>alert("Copied!"));
  }
}
</script>
</body>
</html>
`;

serve(async (req) => {
  const url = new URL(req.url);

  // Web page
  if (url.pathname === "/") {
    return new Response(html, { headers: { "content-type": "text/html" } });
  }

  // Generate new short link (auto code)
  if (url.pathname === "/new") {
    const long = url.searchParams.get("url");
    if (!long) return new Response("Missing ?url=", { status: 400 });

    let code: string;
    let tries = 0;
    do {
      code = generateCode(6);
      const existing = await kv.get(["shortlink", code]);
      if (!existing.value) break;
      tries++;
    } while (tries < 10);

    await kv.set(["shortlink", code], long);

    return new Response(`https://${url.host}/${code}`, { headers: { "content-type": "text/plain" } });
  }

  // Redirect short link
  const code = url.pathname.slice(1);
  if (code) {
    const res = await kv.get(["shortlink", code]);
    if (res?.value) {
      return Response.redirect(res.value as string, 302);
    }
  }

  return new Response("Not found", { status: 404 });
});
