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

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Deno ShortLink Generator</title>
<style>
html, body { height: 100%; margin: 0; font-family: 'Segoe UI', sans-serif; background: #f0f4f8; display: flex; justify-content: center; align-items: center; }
.container { width: 90%; max-width: 600px; background: #fff; padding: 30px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; }
h1 { font-size: 28px; margin-bottom: 20px; color: #333; }
.input-group { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-bottom: 15px; }
input { flex: 1 1 auto; min-width: 200px; padding: 12px; font-size: 18px; border: 2px solid #ccc; border-radius: 8px; }
button { padding: 12px 20px; font-size: 18px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
button:hover { background: #4338ca; }
#result { margin-top: 20px; font-size: 18px; word-break: break-word; }
.copy-btn { padding: 6px 12px; margin-left: 10px; font-size: 16px; cursor: pointer; border-radius: 6px; border: none; background: #10b981; color: #fff; }
.copy-btn:hover { background: #059669; }
@media(max-width: 500px) {
  .input-group { flex-direction: column; }
  input, button { width: 100%; margin: 5px 0; }
}
</style>
</head>
<body>
<div class="container">
<h1>Deno ShortLink Generator</h1>
<div class="input-group">
  <input id="url" type="text" placeholder="Enter your URL here"/>
  <button id="generate">Generate</button>
</div>
<div id="result"></div>
</div>

<script>
document.getElementById("generate").onclick = async () => {
  const url = document.getElementById("url").value;
  if(!url) return alert("Enter URL");

  const resp = await fetch('/new?url=' + encodeURIComponent(url));
  const text = await resp.text();
  const out = document.getElementById("result");
  out.innerHTML = text + '<button class="copy-btn" onclick="copyText()">Copy</button>';
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

  if (url.pathname === "/") {
    return new Response(html, { headers: { "content-type": "text/html" } });
  }

  // auto-code new short link
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

  // redirect
  const code = url.pathname.slice(1);
  if (code) {
    const res = await kv.get(["shortlink", code]);
    if (res?.value) {
      return Response.redirect(res.value as string, 302);
    }
  }

  return new Response("Not found", { status: 404 });
});
