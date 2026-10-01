/**
 * Request authentication.
 *
 * The web app is invoked by the Next.js server (not by end users), so access
 * is controlled with application secrets rather than Google accounts. Two
 * independent secrets are required on every request:
 *
 *   1. APPS_SCRIPT_SECRET  proves the caller is the Next.js server
 *   2. ADMIN_SERVICE_KEY   proves the caller holds a valid admin session
 *
 * The second exists because this web app is deployed ANYONE_ANONYMOUS: its
 * URL is callable by anyone who has it. With only the first secret, an
 * attacker holding the URL and that secret would have full read and write
 * access to the spreadsheet while bypassing the application's PIN entirely.
 * Requiring both means neither one alone is sufficient.
 *
 * Both are stored as Script Properties and compared in constant time. Both
 * fail closed: an unconfigured property rejects every request rather than
 * allowing it.
 */
var Auth = {
  /**
   * @param {string} property
   * @returns {string|null}
   */
  readProperty: function (property) {
    return PropertiesService.getScriptProperties().getProperty(property)
  },

  /**
   * @returns {string|null}
   */
  expectedSecret: function () {
    return Auth.readProperty(Config.SECRET_PROPERTY)
  },

  /**
   * @returns {string|null}
   */
  expectedAdminKey: function () {
    return Auth.readProperty(Config.ADMIN_KEY_PROPERTY)
  },

  /**
   * Throws when the provided secret does not match the stored script property.
   *
   * @param {*} provided
   */
  verify: function (provided) {
    var expected = Auth.expectedSecret()
    if (!expected) {
      throw new AppError(
        Responses.CODES.CONFIGURATION_ERROR,
        "APPS_SCRIPT_SECRET is not configured in the script properties."
      )
    }
    if (typeof provided !== "string" || !Auth.safeCompare(provided, expected)) {
      throw new AppError(Responses.CODES.UNAUTHORIZED, "Invalid or missing API secret.")
    }
  },

  /**
   * Throws when the provided admin key does not match the stored property.
   *
   * @param {*} provided
   */
  verifyAdminKey: function (provided) {
    var expected = Auth.expectedAdminKey()
    if (!expected) {
      throw new AppError(
        Responses.CODES.CONFIGURATION_ERROR,
        "ADMIN_SERVICE_KEY is not configured in the script properties."
      )
    }
    if (typeof provided !== "string" || !Auth.safeCompare(provided, expected)) {
      throw new AppError(
        Responses.CODES.UNAUTHORIZED,
        "Invalid or missing admin service key."
      )
    }
  },

  /**
   * Compares two strings without short-circuiting on the first difference.
   *
   * @param {string} provided
   * @param {string} expected
   * @returns {boolean}
   */
  safeCompare: function (provided, expected) {
    if (provided.length !== expected.length) return false
    var result = 0
    for (var i = 0; i < provided.length; i++) {
      result |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
    }
    return result === 0
  },
}
