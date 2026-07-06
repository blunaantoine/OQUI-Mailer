import { NextRequest, NextResponse } from "next/server";

// POST - Generate OAuth2 authorization URL
export async function POST(request: NextRequest) {
  try {
    const { clientId, redirectUri } = await request.json();

    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID est requis" },
        { status: 400 }
      );
    }

    const scopes = [
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri || "http://localhost:3000",
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: scopes.join(" "),
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({ authUrl });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}