import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { OQUI_EMAIL_TEMPLATE } from "@/lib/email-template";

// Helper: refresh access token
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

async function getAccessToken(oauth2Client: ReturnType<typeof google.auth.OAuth2>) {
  const { credential } = await oauth2Client.refreshAccessToken();
  return credential.access_token as string;
}

function buildRawEmail(to: string, subject: string, fromName: string, fromEmail: string, html: string): string {
  const headers = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
  ];
  const email = `${headers.join("\r\n")}\r\n\r\n${html}`;
  return Buffer.from(email).toString("base64url");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipients, subject } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: "Veuillez fournir au moins un destinataire" },
        { status: 400 }
      );
    }

    if (!subject || typeof subject !== "string") {
      return NextResponse.json(
        { error: "Veuillez fournir un objet pour l'email" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of recipients) {
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: `Adresse email invalide: ${email}` },
          { status: 400 }
        );
      }
    }

    // Get Gmail config
    const gmailSetup = await getGmailClient();
    if (!gmailSetup) {
      return NextResponse.json(
        { error: "Aucune configuration Gmail trouvée. Veuillez d'abord connecter votre compte Gmail." },
        { status: 400 }
      );
    }

    const { oauth2Client, config } = gmailSetup;
    const accessToken = await getAccessToken(oauth2Client);

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const results: { email: string; status: string; error?: string }[] = [];

    // Send to each recipient
    for (const recipient of recipients) {
      try {
        const raw = buildRawEmail(
          recipient,
          subject,
          config.fromName,
          config.fromEmail,
          OQUI_EMAIL_TEMPLATE
        );

        await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw },
        });

        await db.emailRecord.create({
          data: {
            recipient,
            subject,
            status: "sent",
            sentAt: new Date(),
          },
        });

        results.push({ email: recipient, status: "sent" });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
        await db.emailRecord.create({
          data: {
            recipient,
            subject,
            status: "failed",
            errorMessage,
          },
        });
        results.push({ email: recipient, status: "failed", error: errorMessage });
      }
    }

    const sentCount = results.filter((r) => r.status === "sent").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({
      success: true,
      message: `${sentCount} email(s) envoyé(s), ${failedCount} échoué(s)`,
      results,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}