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
<title>ShortLink Generator</title>
<style>
html, body { height: 100%; margin: 0; font-family: 'Segoe UI', sans-serif; background: #f0f4f8; display: flex; justify-content: center; align-items: center; }
.container { width: 90%; max-width: 500px; background: #fff; padding: 30px; border-radius: 15px; box-shadow: 0 8px 20px rgba(0,0,0,0.1); text-align: center; }
h1 { font-size: 26px; margin-bottom: 20px; color: #333; }
.input-group { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-bottom: 15px; }
input { flex: 1 1 auto; min-width: 200px; padding: 12px; font-size: 18px; border: 2px solid #ccc; border-radius: 8px; transition: 0.3s; }
input:focus { border-color: #4f46e5; box-shadow: 0 0 5px rgba(79,70,229,0.5); outline: none; }
button { padding: 12px 20px; font-size: 18px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; cursor: pointer; transition: 0.3s; }
button:hover { background: #4338ca; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
#result { margin-top: 20px; font-size: 18px; word-break: break-word; color: #111; }
.copy-btn { padding: 6px 12px; margin-left: 10px; font-size: 16px; cursor: pointer; border-radius: 6px; border: none; background: #10b981; color: #fff; transition: 0.3s; }
.copy-btn:hover { background: #059669; transform: translateY(-1px); }
.warning { color: #b91c1c; margin-top: 10px; font-size: 16px; }
@media(max-width: 500px) {
  .input-group { flex-direction: column; }
  input, button { width: 100%; margin: 5px 0; }
}
</style>
</head>
<body>
<div class="container">
<h1>ShortLink Generator</h1>
<div class="input-group">
  <input id="url" type="text" placeholder="Enter your URL here"/>
  <button id="generate">Generate</button>
</div>
<div id="result"></div>
<div id="warning" class="warning"></div>
</div>

<script>
document.getElementById("generate").onclick = async () => {
  const url = document.getElementById("url").value.trim();
  const warningEl = document.getElementById("warning");
  const resultEl = document.getElementById("result");
  warningEl.textContent = "";
  resultEl.innerHTML = "";

  if(!url) return warningEl.textContent = "⚠️ Please enter a URL";
  if(!/^https?:\\/\\//.test(url)) return warningEl.textContent = "⚠️ URL must start with http:// or https://";

  const resp = await fetch('/new?url=' + encodeURIComponent(url));
  const text = await resp.text();
  resultEl.innerHTML = text + '<button class="copy-btn" onclick="copyText()">Copy</button>';
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
    if (!/^https?:\/\//.test(long)) return new Response("URL must start with http:// or https://", { status: 400 });

    let code: string;
    let tries = 0;
    do {
      code = Array.from("abcdefghijklmnopqrstuvwxyz0123456789")
        .map(() => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("").slice(0,6);
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
