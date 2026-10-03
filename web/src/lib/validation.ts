/** HTML pattern attributes. Keep in sync with backend/src/modules/auth/dto/auth.dto.ts */
export const PASSWORD_PATTERN = "(?=.*[A-Za-z])(?=.*\\d).{8,72}";
export const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";
export const PK_PHONE_PATTERN = "(\\+92|0)3[0-9]{9}";
export const OTP_PATTERN = "[0-9]{6}";

export const PAKISTAN_CITIES = [
  "Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan",
  "Gujranwala", "Peshawar", "Quetta", "Sialkot", "Hyderabad", "Bahawalpur",
];

/** Only allow same-site relative paths as post-login destinations (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
