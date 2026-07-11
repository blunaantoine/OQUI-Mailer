import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://oqui-mailer.vercel.app";

export async function POST(request: NextRequest) {
  try {
    const { clientId } = await request.json();
    if (!clientId) return NextResponse.json({ error: "Client ID requis" }, { status: 400 });

    const redirectUri = `${APP_URL}/api/gmail/callback`;
    const scopes = [
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: scopes.join(" "),
      // Encode state with client info so callback can find it
      state: "oqui-mailer",
    });

    return NextResponse.json({
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      redirectUri,
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}