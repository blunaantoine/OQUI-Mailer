import { NextRequest, NextResponse } from "next/server";

const APP_URL = "https://oqui-mailer.vercel.app";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(page("Erreur Google : " + error, true), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (!code) {
    return new NextResponse(page("Aucun code reçu.", true), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Show the code to the user — they'll paste it in the app
  return new NextResponse(pageWithCode(code), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function pageWithCode(code: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OQUI Mailer - Autorisation réussie</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px; text-align: center; max-width: 520px; width: 100%; }
    .icon { width: 64px; height: 64px; background: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    .icon svg { width: 32px; height: 32px; color: #059669; }
    h1 { font-size: 22px; color: #0b3d2e; margin-bottom: 8px; }
    p { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
    .code-box { background: #f0faf5; border: 2px dashed #0b3d2e; border-radius: 12px; padding: 16px; margin-bottom: 20px; word-break: break-all; font-family: monospace; font-size: 12px; color: #0b3d2e; cursor: pointer; position: relative; }
    .code-box:hover { background: #e6f7ef; }
    .code-box::after { content: 'Cliquez pour copier'; position: absolute; top: 8px; right: 12px; font-size: 11px; color: #059669; font-family: -apple-system, sans-serif; }
    .code-box.copied::after { content: '✓ Copié !'; }
    .steps { text-align: left; background: #f8f9fa; border-radius: 10px; padding: 16px; margin-bottom: 20px; }
    .steps ol { padding-left: 20px; color: #555; font-size: 13px; line-height: 1.8; }
    a { display: inline-block; background: #0b3d2e; color: white !important; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    a:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
    </div>
    <h1>Autorisation réussie !</h1>
    <p>Copiez le code ci-dessous et collez-le dans l'application OQUI Mailer.</p>
    <div class="code-box" id="code" onclick="copyCode()">${code}</div>
    <div class="steps">
      <ol>
        <li>Cliquez sur la zone verte pour copier le code</li>
        <li>Retournez sur <a href="${APP_URL}" style="display:inline; padding:4px 12px; font-size:13px; border-radius:6px; margin:0;">OQUI Mailer</a></li>
        <li>Collez le code dans le champ prévu</li>
      </ol>
    </div>
    <a href="${APP_URL}">Retour à OQUI Mailer →</a>
  </div>
  <script>
    function copyCode() {
      navigator.clipboard.writeText("${code}");
      document.getElementById('code').classList.add('copied');
      setTimeout(() => document.getElementById('code').classList.remove('copied'), 2000);
    }
  </script>
</body>
</html>`;
}

function page(message: string, isError: boolean) {
  const color = isError ? "#dc2626" : "#059669";
  const bg = isError ? "#fef2f2" : "#ecfdf5";
  const title = isError ? "Erreur" : "Succès";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>OQUI Mailer</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f4f4f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.card{background:white;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:40px;text-align:center;max-width:440px;width:100%}h1{font-size:22px;color:${color};margin-bottom:8px}p{color:#666;font-size:14px;line-height:1.6;margin-bottom:24px}a{display:inline-block;background:#0b3d2e;color:white;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600}</a></style></head><body><div class="card"><h1>${title}</h1><p>${message}</p><a href="${APP_URL}">Retour à OQUI Mailer</a></div></body></html>`;
}