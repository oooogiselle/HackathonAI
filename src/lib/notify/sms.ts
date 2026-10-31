// Text messages, only for sign-up phone codes. Twilio's REST API when
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are set; otherwise the
// text is logged to the server console.
import "server-only";

export function smsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM,
  );
}

/** US numbers as 10 digits. Returns true when it was really sent. */
export async function sendSms(tenDigits: string, body: string): Promise<boolean> {
  if (!smsConfigured()) {
    console.log(`[mock:sms] → +1${tenDigits}\n${body}\n`);
    return false;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: `+1${tenDigits}`, From: process.env.TWILIO_FROM!, Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  return true;
}
