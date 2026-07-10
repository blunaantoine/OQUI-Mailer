import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { google } from "googleapis";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://oqui-mailer.vercel.app";

// Helper: get an authenticated Gmail client from stored config
async function getGmailClient() {
  const configs = await db.gmailConfig.findMany({
    orderBy: { createdAt: "desc" },
  });
  if (configs.length === 0) return null;

  const config = configs[0];
  // Skip "pending" entries
  if (config.fromEmail === "pending" || config.fromEmail === "ready" || !config.refreshToken) return null;

  const oauth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret);
  oauth2Client.setCredentials({ refresh_token: config.refreshToken });

  return { oauth2Client, config };
}

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

    const latest = configs[0];

    // If callback completed but not finalized, return "callback_done" state
    if (latest.fromEmail === "ready" && latest.refreshToken) {
      return NextResponse.json({
        configured: false,
        callbackDone: true,
        message: "Autorisation Google réussie. Finalisez la configuration.",
      });
    }

    // If still pending
    if (latest.fromEmail === "pending") {
      return NextResponse.json({ configured: false });
    }

    // Try to validate the refresh token
    const oauth2Client = new google.auth.OAuth2(latest.clientId, latest.clientSecret);
    oauth2Client.setCredentials({ refresh_token: latest.refreshToken });

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
      fromEmail: latest.fromEmail,
      fromName: latest.fromName,
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST - Save/finalize Gmail config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, clientSecret, refreshToken, fromEmail, fromName, finalize } = body;

    // Finalize flow: user provided fromEmail/fromName after callback
    if (finalize) {
      const ready = await db.gmailConfig.findFirst({
        where: { fromEmail: "ready" },
      });
      if (!ready || !ready.refreshToken) {
        return NextResponse.json(
          { error: "Aucune autorisation en attente. Relancez la connexion." },
          { status: 400 }
        );
      }

      if (!fromEmail) {
        return NextResponse.json(
          { error: "L'email de l'expéditeur est requis" },
          { status: 400 }
        );
      }

      // Validate token works
      const oauth2Client = new google.auth.OAuth2(ready.clientId, ready.clientSecret);
      oauth2Client.setCredentials({ refresh_token: ready.refreshToken });

      try {
        await getAccessToken(oauth2Client);
      } catch {
        return NextResponse.json(
          { error: "Token invalide. Veuillez relancer la connexion." },
          { status: 400 }
        );
      }

      // Update with final info
      await db.gmailConfig.update({
        where: { id: ready.id },
        data: {
          fromEmail,
          fromName: fromName || "L'équipe OQUI",
        },
      });

      // Clean up any old/pending configs
      await db.gmailConfig.deleteMany({
        where: { id: { not: ready.id } },
      });

      return NextResponse.json({
        success: true,
        message: "Configuration Gmail sauvegardée avec succès",
      });
    }

    // Legacy flow: manual token entry
    if (!clientId || !clientSecret || !refreshToken || !fromEmail) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
      await getAccessToken(oauth2Client);
    } catch {
      return NextResponse.json(
        { error: "Impossible d'obtenir un token d'accès. Vérifiez vos identifiants." },
        { status: 400 }
      );
    }

    await db.gmailConfig.deleteMany();
    await db.gmailConfig.create({
      data: { clientId, clientSecret, refreshToken, fromEmail, fromName: fromName || "L'équipe OQUI" },
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

export { getGmailClient, getAccessToken };