/**
 * Response helpers and the application error type.
 *
 * Every handler returns a JSON object through Responses.ok / Responses.fail,
 * and Errors are surfaced through AppError so the entry point can serialize
 * them consistently.
 */

/**
 * Application-level error. Carries a stable machine-readable code and a
 * human-readable message that the Next.js client can relay to users.
 *
 * @param {string} code
 * @param {string} message
 * @constructor
 */
function AppError(code, message) {
  this.name = "AppError"
  this.code = code
  this.message = message
}

AppError.prototype = Object.create(Error.prototype)
AppError.prototype.constructor = AppError

var Responses = {
  CODES: {
    INVALID_REQUEST: "INVALID_REQUEST",
    INVALID_FIELD: "INVALID_FIELD",
    UNAUTHORIZED: "UNAUTHORIZED",
    METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
    CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
    EVENT_NOT_FOUND: "EVENT_NOT_FOUND",
    EVENT_NOT_ACTIVE: "EVENT_NOT_ACTIVE",
    ORG_NOT_FOUND: "ORG_NOT_FOUND",
    SRCODE_NOT_FOUND: "SRCODE_NOT_FOUND",
    DUPLICATE_ATTENDANCE: "DUPLICATE_ATTENDANCE",
    INTERNAL_ERROR: "INTERNAL_ERROR",
  },

  /**
   * Wraps a payload as a JSON text output for a web app.
   *
   * @param {Object} payload
   * @returns {GoogleAppsScript.Content.TextOutput}
   */
  json: function (payload) {
    return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
      ContentService.MimeType.JSON
    )
  },

  /**
   * @param {string} message
   * @param {Object} [extra] - Success payload fields, e.g. { event } or { student }.
   * @returns {Object}
   */
  ok: function (message, extra) {
    return Object.assign({ success: true, message: message }, extra)
  },

  /**
   * @param {string} code
   * @param {string} message
   * @returns {Object}
   */
  fail: function (code, message) {
    return { success: false, code: code, message: message }
  },
}