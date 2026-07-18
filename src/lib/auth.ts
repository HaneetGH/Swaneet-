import { cookies } from "next/headers";

export const ADMIN_COOKIE = "swaneet_admin";
const TOKEN = "authenticated";

export function getAdminPin() {
  return process.env.ADMIN_PIN || "swaneet2026";
}

export async function isAuthenticated() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === TOKEN;
}

export function authCookieValue() {
  return TOKEN;
}
