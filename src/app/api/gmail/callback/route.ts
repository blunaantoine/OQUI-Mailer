import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";

const APP_URL = "https://oqui-mailer.vercel.app";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(errorPage(`Erreur Google : ${error}`), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (!code) {
    return new NextResponse(errorPage("Aucun code d'autorisation reçu."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Check if we have a pending config (clientId + clientSecret stored temporarily)
  const pending = await db.gmailConfig.findFirst({
    where: { fromEmail: "pending" },
  });

  if (!pending) {
    return new NextResponse(
      errorPage("Aucune configuration en attente. Lancez d'abord la configuration depuis l'application."),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Exchange code for tokens
  try {
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: pending.clientId,
        client_secret: pending.clientSecret,
        redirect_uri: `${APP_URL}/api/gmail/callback`,
        grant_type: "authorization_code",
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.refresh_token) {
      return new NextResponse(
        errorPage(
          `Échec de l'échange de token : ${data.error_description || data.error || "Token manquant (assurez-vous d'utiliser prompt=consent)"}`
        ),
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Update the config with the refresh token
    await db.gmailConfig.update({
      where: { id: pending.id },
      data: {
        refreshToken: data.refresh_token,
        fromEmail: "ready",
      },
    });

    return new NextResponse(successPage(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return new NextResponse(errorPage(message), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

function successPage() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OQUI Mailer - Connecté</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 48px; text-align: center; max-width: 440px; width: 90%; }
    .icon { width: 64px; height: 64px; background: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    .icon svg { width: 32px; height: 32px; color: #059669; }
    h1 { font-size: 24px; color: #0b3d2e; margin-bottom: 8px; }
    p { color: #666; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
    a { display: inline-block; background: #0b3d2e; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    a:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
    </div>
    <h1>Connecté avec succès !</h1>
    <p>Votre compte Gmail a été autorisé. Vous pouvez maintenant envoyer des emails depuis OQUI Mailer.</p>
    <a href="${APP_URL}">Aller à OQUI Mailer</a>
  </div>
</body>
</html>`;
}

function errorPage(message: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OQUI Mailer - Erreur</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 48px; text-align: center; max-width: 440px; width: 90%; }
    .icon { width: 64px; height: 64px; background: #fef2f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    .icon svg { width: 32px; height: 32px; color: #dc2626; }
    h1 { font-size: 24px; color: #991b1b; margin-bottom: 8px; }
    p { color: #666; font-size: 15px; line-height: 1.6; margin-bottom: 24px; word-break: break-word; }
    a { display: inline-block; background: #0b3d2e; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    a:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    </div>
    <h1>Erreur de connexion</h1>
    <p>${message}</p>
    <a href="${APP_URL}">Retour à OQUI Mailer</a>
  </div>
</body>
</html>`;
}