import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { OQUI_EMAIL_TEMPLATE } from "@/lib/email-template";

function generateMessageId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `<${timestamp}-${random}@oqui.duckdns.org>`;
}

function generateBoundary(): string {
  const random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `----=_Part_${random}`;
}

function formatRfc2822Date(): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${days[now.getUTCDay()]}, ${pad(now.getUTCDate())} ${months[now.getUTCMonth()]} ${now.getUTCFullYear()} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} +0000`;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "\t")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&ecirc;/g, "ê")
    .replace(/&euml;/g, "ë")
    .replace(/&agrave;/g, "à")
    .replace(/&acirc;/g, "â")
    .replace(/&iuml;/g, "ï")
    .replace(/&ocirc;/g, "ô")
    .replace(/&ucirc;/g, "û")
    .replace(/&ugrave;/g, "ù")
    .replace(/&ccedil;/g, "ç")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildRawEmail(
  to: string,
  subject: string,
  fromName: string,
  fromEmail: string,
  html: string
): string {
  const boundary = generateBoundary();
  const messageId = generateMessageId();
  const date = formatRfc2822Date();
  const plainText = stripHtmlToText(html);

  const headers = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`,
    `Message-ID: ${messageId}`,
    `Date: ${date}`,
    `Reply-To: ${fromEmail}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `List-Unsubscribe: <mailto:${fromEmail}?subject=Unsubscribe>`,
    `X-Mailer: OQUI Mailer`,
    `X-Priority: 3`,
    `X-MimeOLE: Produced By OQUI Mailer`,
    `Precedence: bulk`,
  ];

  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    plainText,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    html,
    ``,
    `--${boundary}--`,
  ];

  const email = `${headers.join("\r\n")}\r\n\r\n${body.join("\r\n")}`;
  return Buffer.from(email).toString("base64url");
}

export async function POST(request: NextRequest) {
  try {
    const { recipients, subject, clientId, clientSecret, refreshToken, fromName, fromEmail, html } = await request.json();

    if (!recipients?.length || !subject) {
      return NextResponse.json({ error: "Destinataires et objet requis" }, { status: 400 });
    }
    if (!clientId || !clientSecret || !refreshToken || !fromEmail) {
      return NextResponse.json({ error: "Configuration Gmail requise" }, { status: 400 });
    }

    const emailHtml = html || OQUI_EMAIL_TEMPLATE;

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
        const raw = buildRawEmail(recipient, subject, fromName || "OQUI", fromEmail, emailHtml);
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