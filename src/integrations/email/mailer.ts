import nodemailer from "nodemailer";
import { env } from "@/config/env";

export type EmailMessage = { to: string; subject: string; text: string };

export async function sendEmail(message: EmailMessage): Promise<void> {
  const config = env();
  if (config.NODE_ENV === "production" && (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASSWORD)) throw new Error("Production SMTP configuration is incomplete");
  const transport = config.SMTP_HOST
    ? nodemailer.createTransport({ host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_SECURE, auth: config.SMTP_USER && config.SMTP_PASSWORD ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined, tls: { rejectUnauthorized: config.NODE_ENV === "production" } })
    : nodemailer.createTransport({ jsonTransport: true });
  await transport.sendMail({ from: config.SMTP_FROM, to: message.to, subject: message.subject, text: message.text });
}
