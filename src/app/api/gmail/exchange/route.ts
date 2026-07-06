import { NextRequest, NextResponse } from "next/server";

// POST - Exchange authorization code for tokens
export async function POST(request: NextRequest) {
  try {
    const { clientId, clientSecret, code, redirectUri } = await request.json();

    if (!clientId || !clientSecret || !code) {
      return NextResponse.json(
        { error: "Client ID, Client Secret et le code d'autorisation sont requis" },
        { status: 400 }
      );
    }

    const tokenUrl = "https://oauth2.googleapis.com/token";
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri || "http://localhost:3000",
        grant_type: "authorization_code",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error_description || data.error || "Échange de token échoué" },
        { status: 400 }
      );
    }

    if (!data.refresh_token) {
      return NextResponse.json(
        { error: "Aucun refresh token obtenu. Assurez-vous d'utiliser prompt=consent." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      refreshToken: data.refresh_token,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}