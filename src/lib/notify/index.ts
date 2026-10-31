// notify(event, to, data): the only way Ask emails anyone. Exactly the three PRD
// events. Call it only after the request that won the state update has
// committed, so each event sends once. Messages never name the asker.
// Gmail SMTP is used when its env vars are set; otherwise the console adapter.
// sendVerificationEmail is the one other email: sign-up codes.
import "server-only";

import { siteUrl } from "@/lib/site-url";

import { consoleAdapter } from "./console";
import { gmailAdapter } from "./gmail";
import type { Email, EmailAdapter } from "./types";

const adapters: EmailAdapter[] = [gmailAdapter];

function pickAdapter() {
  return adapters.find((a) => a.isConfigured()) ?? consoleAdapter;
}

export type NotifyEvent =
  // A helper was picked for a private ask.
  | "private-ask"
  // Someone said "I can help" on the asker's ask (board, GroupMe link or private).
  | "claimed"
  // The other side marked the help done; `to` should confirm.
  | "done";

export type NotifyData = {
  askToken: string;
  title: string;
  // Only the helper's first name, and only in emails to the asker.
  helperFirstName?: string;
  // "done" emails: who marked it done.
  by?: "asker" | "helper";
};

function compose(event: NotifyEvent, to: string, data: NotifyData): Email {
  const ask = `“${data.title}”`;
  switch (event) {
    case "private-ask":
      return {
        to,
        subject: "A classmate asked for your help",
        text: `A classmate asked you: ${ask}.\nSay "I can help" or "Not this time": ${siteUrl()}/h/${data.askToken}`,
      };
    case "claimed":
      return {
        to,
        subject: `${data.helperFirstName ?? "Someone"} can help`,
        text: `${data.helperFirstName ?? "A helper"} said yes to ${ask}.\nConfirm to lock it in: ${siteUrl()}/matched/${data.askToken}`,
      };
    case "done":
      return data.by === "helper"
        ? {
            to,
            subject: "Confirm it's done",
            text: `Your helper marked ${ask} done.\nConfirm, or report a problem: ${siteUrl()}/matched/${data.askToken}\nIt confirms automatically in 48 h.`,
          }
        : {
            to,
            subject: "The asker confirmed it's done",
            text: `The asker confirmed ${ask} is done. Thank you for helping.\n${siteUrl()}/h/${data.askToken}`,
          };
  }
}

/** Never throws: a failed email must not undo a claim that already happened. */
export async function notify(event: NotifyEvent, to: string, data: NotifyData): Promise<void> {
  await pickAdapter()
    .send(compose(event, to, data))
    .catch((error) => {
      console.error(`notify(${event}) failed:`, error);
    });
}

/**
 * Sign-up code to a school email. Returns true when a real adapter sent it,
 * false when it was only logged to the console (no email keys set).
 */
export async function sendVerificationEmail(to: string, code: string): Promise<boolean> {
  const adapter = pickAdapter();
  await adapter.send({
    to,
    subject: `${code} is your DartAsk code`,
    text: `Your DartAsk school email code is ${code}. It expires in 10 minutes.\nIf you didn't sign up, ignore this email.`,
  });
  return adapter !== consoleAdapter;
}
