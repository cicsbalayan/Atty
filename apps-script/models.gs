/**
 * Domain models and row-to-object mappers.
 *
 * Google Apps Script does not support type imports, so these JSDoc typedefs
 * document the shape of the objects exchanged with the Next.js client. The
 * mappers convert raw spreadsheet rows into stable domain objects.
 */

/**
 * @typedef {Object} Student
 * @property {string} srcode
 * @property {string} name
 * @property {string} college
 * @property {string} program
 * @property {string} yearLevel
 * @property {string} gender
 */

/**
 * @typedef {Object} Organization
 * @property {string} id
 * @property {string} name
 * @property {string} email
 */

/**
 * @typedef {Object} SchoolEvent
 * @property {string} id
 * @property {string} name
 * @property {string} date
 * @property {string} status
 * @property {string} sheetName
 * @property {string} location
 * @property {string} description
 * @property {string} orgId
 * @property {string} time
 */

/**
 * @typedef {Object} AttendanceRecord
 * @property {string} timestamp
 * @property {string} srcode
 * @property {string} name
 * @property {string} college
 * @property {string} program
 * @property {string} yearLevel
 * @property {string} gender
 */

var Models = {
  studentFromRow: function (row) {
    var columns = Config.COLUMNS.MASTERLIST;
    return {
      srcode: String(row[columns.SRCODE] || "").trim(),
      name: String(row[columns.FULL_NAME] || "").trim(),
      college: String(row[columns.COLLEGE] || "").trim(),
      program: String(row[columns.PROGRAM] || "").trim(),
      yearLevel: String(row[columns.YEAR_LEVEL] || "").trim(),
      gender: String(row[columns.GENDER] || "").trim(),
    }
  },

  /**
   * @param {string[]} row
   * @returns {Organization|null}
   */
  organizationFromRow: function (row) {
    if (!row) return null
    var columns = Config.COLUMNS.ORGANIZATIONS
    var id = String(row[columns.ID] || "").trim()
    if (!id) return null
    return {
      id: id,
      name: String(row[columns.NAME] || ""),
      email: String(row[columns.EMAIL] || ""),
    }
  },

  eventFromRow: function (row) {
    if (!row) return null
    var columns = Config.COLUMNS.EVENTS
    var id = String(row[columns.ID] || "").trim()
    if (!id) return null
    return {
      id: id,
      name: String(row[columns.NAME] || ""),
      date: Models.formatDate(row[columns.DATE]),
      status: String(row[columns.STATUS] || Config.DEFAULT_EVENT_STATUS),
      sheetName: String(row[columns.SHEET_NAME] || id),
      location: String(row[columns.LOCATION] || ""),
      description: String(row[columns.DESCRIPTION] || ""),
      orgId: String(row[columns.ORG_ID] || ""),
      time: String(row[columns.TIME] || ""),
    }
  },

  /**
   * Builds an AttendanceRecord (attendance row joined with student data).
   *
   * @param {string[]} row - The attendance sheet row: [timestamp, srcode].
   * @param {Student} [student] - The matched student, used for the join.
   * @returns {AttendanceRecord}
   */
  attendanceRecordFromRow: function (row, student) {
    var columns = Config.COLUMNS.ATTENDANCE
    var source = student || {}
    return {
      timestamp: Models.formatDateTime(row[columns.TIMESTAMP]),
      srcode: String(row[columns.SRCODE] || "").trim(),
      name: String(source.name || ""),
      college: String(source.college || ""),
      program: String(source.program || ""),
      yearLevel: String(source.yearLevel || ""),
      gender: String(source.gender || ""),
    }
  },

  /**
   * Sheets returns date-formatted cells as Date objects, whose default
   * string form ("Sat Jan 10 2026 00:00:00 GMT+0800...") is unstable and
   * ugly. Normalize back to the sheet date format so reads match writes.
   *
   * @param {*} value
   * @returns {string}
   */
  formatDate: function (value) {
    if (value instanceof Date) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), Config.DATE_FORMAT)
    }
    return String(value || "")
  },

  /**
   * Same as formatDate but keeps the time component for timestamps.
   *
   * @param {*} value
   * @returns {string}
   */
  formatDateTime: function (value) {
    if (value instanceof Date) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), Config.TIME_FORMAT)
    }
    return String(value || "")
  },
}