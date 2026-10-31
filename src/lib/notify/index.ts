// notify(event, to, data): the only way Ask emails anyone. Exactly the three PRD
// events. Call it only after the request that won the state update has
// committed, so each event sends once. Messages never name the asker.
// To add a channel (e.g. Gmail SMTP): write an adapter and put it first below.
import "server-only";

import { siteUrl } from "@/lib/site-url";

import { consoleAdapter } from "./console";
import type { Email, EmailAdapter } from "./types";

const adapters: EmailAdapter[] = [];

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
  const adapter = adapters.find((a) => a.isConfigured()) ?? consoleAdapter;
  await adapter.send(compose(event, to, data)).catch((error) => {
    console.error(`notify(${event}) failed:`, error);
  });
}
