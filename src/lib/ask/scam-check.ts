// Scam guard for the asker–helper thread. Paying outside Ask skips the hold that
// protects both sides, and nobody helping with an ask needs an ID or account
// number. Students new to the US (often on visas) are the usual targets.
// It only warns: the sender can still tap "Send anyway". Client-safe; the model
// check in src/lib/ai/ask/message-check.ts can only add a flag, never remove one.

export const MESSAGE_FLAGS = ["off-platform-payment", "id-number"] as const;
export type MessageFlag = (typeof MESSAGE_FLAGS)[number];

const PAYMENT =
  /\b(venmo|zelle|cash ?app|paypal|wechat ?pay|alipay|apple cash|wire (transfer|the money)|western union|moneygram|crypto|bitcoin|btc|usdt|gift ?cards?)\b|\bpay (me )?(directly|outside( of)? (ask|the app)|off (the )?app)\b/i;

// Numbers only: "you'll need your passport" is normal SSN help, and "send me a
// pin" is a map location.
const ID_TERMS =
  "ssn|social security number|passport number|bank account number|account number|routing number|card number|credit card( number)?|cvv|pin number";
// Asking for one ("send me your SSN"), not just mentioning one ("I got my SSN").
const ID_REQUEST = new RegExp(
  `\\b(send|share|give|text|tell me|what'?s)\\b.{0,30}\\b(${ID_TERMS})\\b`,
  "i",
);
// A photo of an ID document is as good as the number.
const ID_PHOTO =
  /\b(photo|picture|pic|scan|copy) of (your |ur )?(passport|ssn|social security card|i-20|visa|id card|bank card|credit card)\b/i;
const SSN_SHAPED = /\b\d{3}-\d{2}-\d{4}\b/;
// 13–19 digits, optionally grouped with spaces or dashes, like a card number.
const CARD_SHAPED = /\b(?:\d[ -]?){12,18}\d\b/;

export function scamKeywordCheck(text: string): MessageFlag | null {
  if (PAYMENT.test(text)) return "off-platform-payment";
  if ([ID_REQUEST, ID_PHOTO, SSN_SHAPED, CARD_SHAPED].some((re) => re.test(text)))
    return "id-number";
  return null;
}

export const FLAG_COPY: Record<MessageFlag, { sender: string; receiver: string }> = {
  "off-platform-payment": {
    sender:
      "Paying outside Ask isn't protected. Through Ask, the money is held until the help is done.",
    receiver:
      "This mentions paying outside Ask. Pay only through Ask: it holds the money until the help is done.",
  },
  "id-number": {
    sender: "This looks like an ID or account number. Nobody helping with an ask needs one.",
    receiver:
      "Never share ID or account numbers in messages (SSN, passport, bank). Nobody helping you needs them.",
  },
};
