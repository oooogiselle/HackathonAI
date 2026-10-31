// Emails and phone numbers in free text. Shared by the privacy scrub (anonymous
// posts) and the message thread (warn before contact info is shared early).

export const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.]+/g;
export const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;

/** Each email or phone number in `text`, as written. */
export function findContactInfo(text: string): string[] {
  return [EMAIL_PATTERN, PHONE_PATTERN].flatMap((pattern) =>
    (text.match(pattern) ?? []).map((match) => match.trim()),
  );
}
