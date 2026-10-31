// Gmail SMTP, used when GMAIL_USER and GMAIL_APP_PASSWORD are set (an app
// password, not the account password). Otherwise emails go to the console.
import "server-only";

import nodemailer from "nodemailer";

import type { EmailAdapter } from "./types";

let transport: ReturnType<typeof nodemailer.createTransport> | undefined;

export const gmailAdapter: EmailAdapter = {
  isConfigured: () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),

  async send(email) {
    transport ??= nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transport.sendMail({
      from: `DartAsk <${process.env.GMAIL_USER}>`,
      to: email.to,
      subject: email.subject,
      text: email.text,
    });
  },
};
