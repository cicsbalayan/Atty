import { AppsScriptError } from "./errors"
import { getAdminServiceKey } from "@/lib/auth/config"

/**
 * Server-only configuration for the Apps Script Web App.
 *
 * The Web App URL, the shared secret, and the admin service key must never be
 * exposed to the browser. They are read from the server environment on every
 * request.
 */
export interface AppsScriptConfig {
  url: string
  secret: string
  adminKey: string
}

export function getAppsScriptConfig(): AppsScriptConfig {
  const url = process.env.APPS_SCRIPT_URL
  const secret = process.env.APPS_SCRIPT_SECRET

  if (!url) {
    throw new AppsScriptError("CONFIGURATION_ERROR", "APPS_SCRIPT_URL is not set.", "config")
  }
  if (!secret) {
    throw new AppsScriptError("CONFIGURATION_ERROR", "APPS_SCRIPT_SECRET is not set.", "config")
  }
  // Throws a 503 HttpError when unset or too short, so a missing admin key
  // fails the request closed rather than reaching Apps Script and being
  // rejected there after a full round trip.
  const adminKey = getAdminServiceKey()

  return { url, secret, adminKey }
}
