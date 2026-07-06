import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { OQUI_EMAIL_TEMPLATE } from "@/lib/email-template";

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

    // Get SMTP config from DB
    const smtpConfigs = await db.smtpConfig.findMany();
    if (smtpConfigs.length === 0) {
      return NextResponse.json(
        { error: "Aucune configuration SMTP trouvée. Veuillez d'abord configurer le SMTP." },
        { status: 400 }
      );
    }

    const config = smtpConfigs[smtpConfigs.length - 1]; // use latest

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });

    // Verify connection
    await transporter.verify();

    const from = `${config.fromName} <${config.fromEmail}>`;
    const results: { email: string; status: string; error?: string }[] = [];

    // Send to each recipient
    for (const recipient of recipients) {
      try {
        await transporter.sendMail({
          from,
          to: recipient,
          subject,
          html: OQUI_EMAIL_TEMPLATE,
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