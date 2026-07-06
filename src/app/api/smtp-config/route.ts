import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";

// GET - Retrieve SMTP config
export async function GET() {
  try {
    const configs = await db.smtpConfig.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (configs.length === 0) {
      return NextResponse.json({ configured: false });
    }

    const config = configs[0];
    return NextResponse.json({
      configured: true,
      host: config.host,
      port: config.port,
      user: config.user,
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      secure: config.secure,
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST - Save SMTP config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { host, port, user, password, fromName, fromEmail, secure } = body;

    if (!host || !port || !user || !password || !fromName || !fromEmail) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 }
      );
    }

    // Validate by creating a test transport
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: secure !== false,
      auth: { user, pass: password },
    });

    try {
      await transporter.verify();
    } catch {
      return NextResponse.json(
        { error: "Impossible de se connecter au serveur SMTP. Vérifiez vos identifiants." },
        { status: 400 }
      );
    }

    // Save config
    await db.smtpConfig.create({
      data: {
        host,
        port: Number(port),
        user,
        password,
        fromName,
        fromEmail,
        secure: secure !== false,
      },
    });

    return NextResponse.json({ success: true, message: "Configuration SMTP sauvegardée avec succès" });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE - Remove all SMTP configs
export async function DELETE() {
  try {
    await db.smtpConfig.deleteMany();
    return NextResponse.json({ success: true, message: "Configuration supprimée" });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}