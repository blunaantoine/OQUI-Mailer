import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { google } from "googleapis";

// Helper: get an authenticated Gmail client from stored config
async function getGmailClient() {
  const configs = await db.gmailConfig.findMany({
    orderBy: { createdAt: "desc" },
  });
  if (configs.length === 0) return null;

  const config = configs[0];

  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret
  );
  oauth2Client.setCredentials({ refresh_token: config.refreshToken });

  return { oauth2Client, config };
}

// Helper: refresh access token
async function getAccessToken(oauth2Client: ReturnType<typeof google.auth.OAuth2>) {
  const { credential } = await oauth2Client.refreshAccessToken();
  return credential.access_token;
}

// GET - Check Gmail config status
export async function GET() {
  try {
    const configs = await db.gmailConfig.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (configs.length === 0) {
      return NextResponse.json({ configured: false });
    }

    const config = configs[0];

    // Try to validate the refresh token
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret
    );
    oauth2Client.setCredentials({ refresh_token: config.refreshToken });

    try {
      await getAccessToken(oauth2Client);
    } catch {
      return NextResponse.json({
        configured: false,
        error: "Token expiré ou invalide. Veuillez reconnecter.",
      });
    }

    return NextResponse.json({
      configured: true,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST - Save Gmail config (clientId, clientSecret, refreshToken, fromEmail, fromName)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, clientSecret, refreshToken, fromEmail, fromName } = body;

    if (!clientId || !clientSecret || !refreshToken || !fromEmail) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 }
      );
    }

    // Validate by trying to get an access token
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
      await getAccessToken(oauth2Client);
    } catch {
      return NextResponse.json(
        { error: "Impossible d'obtenir un token d'accès. Vérifiez vos identifiants et le refresh token." },
        { status: 400 }
      );
    }

    // Delete old configs
    await db.gmailConfig.deleteMany();

    // Save new config
    await db.gmailConfig.create({
      data: {
        clientId,
        clientSecret,
        refreshToken,
        fromEmail,
        fromName: fromName || "L'équipe OQUI",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Configuration Gmail sauvegardée avec succès",
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE - Remove Gmail config
export async function DELETE() {
  try {
    await db.gmailConfig.deleteMany();
    return NextResponse.json({ success: true, message: "Configuration supprimée" });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Export helpers for use in send-email route
export { getGmailClient, getAccessToken };