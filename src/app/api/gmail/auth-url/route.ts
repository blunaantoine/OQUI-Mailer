import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://oqui-mailer.vercel.app";
const CALLBACK_PATH = "/api/gmail/callback";

// POST - Generate OAuth2 authorization URL and store pending config
export async function POST(request: NextRequest) {
  try {
    const { clientId, clientSecret } = await request.json();

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Client ID et Client Secret sont requis" },
        { status: 400 }
      );
    }

    // Store credentials as "pending" so the callback can use them
    await db.gmailConfig.deleteMany({ where: { fromEmail: "pending" } });
    await db.gmailConfig.create({
      data: {
        clientId,
        clientSecret,
        refreshToken: "", // will be filled by callback
        fromEmail: "pending",
        fromName: "pending",
      },
    });

    const redirectUri = `${APP_URL}${CALLBACK_PATH}`;

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
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({ authUrl, redirectUri });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}