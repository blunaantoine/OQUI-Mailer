import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { clientId, clientSecret, code, redirectUri } = await request.json();
    if (!clientId || !clientSecret || !code) {
      return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error_description || data.error || "Échange échoué" }, { status: 400 });
    }
    if (!data.refresh_token) {
      return NextResponse.json({ error: "Aucun refresh token. Utilisez prompt=consent." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      refreshToken: data.refresh_token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}