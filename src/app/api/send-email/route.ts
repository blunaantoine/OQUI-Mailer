import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { OQUI_EMAIL_TEMPLATE } from "@/lib/email-template";

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
    const { recipients, subject, clientId, clientSecret, refreshToken, fromName, fromEmail } = await request.json();

    if (!recipients?.length || !subject) {
      return NextResponse.json({ error: "Destinataires et objet requis" }, { status: 400 });
    }
    if (!clientId || !clientSecret || !refreshToken || !fromEmail) {
      return NextResponse.json({ error: "Configuration Gmail requise" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of recipients) {
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: `Email invalide: ${email}` }, { status: 400 });
      }
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const results: { email: string; status: string; error?: string }[] = [];

    for (const recipient of recipients) {
      try {
        const raw = buildRawEmail(recipient, subject, fromName || "OQUI", fromEmail, OQUI_EMAIL_TEMPLATE);
        await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
        results.push({ email: recipient, status: "sent" });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        results.push({ email: recipient, status: "failed", error: msg });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({
      success: true,
      message: `${sent} envoyé(s), ${failed} échoué(s)`,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}