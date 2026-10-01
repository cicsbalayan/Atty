/**
 * Low-level Google Sheets access.
 *
 * Reading happens with bulk getValues()/appendRow() calls instead of cell
 * by cell reads so the backend stays within reasonable read quotas.
 */
var Sheets = {
  /**
   * Resolves the current spreadsheet. Prefers the container-bound spreadsheet
   * and falls back to SPREADSHEET_ID from the script properties.
   *
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  getSpreadsheet: function () {
    var active = SpreadsheetApp.getActiveSpreadsheet()
    if (active) return active
    var key = PropertiesService.getScriptProperties().getProperty(Config.SPREADSHEET_KEY_PROPERTY)
    if (!key) {
      throw new AppError(
        Responses.CODES.CONFIGURATION_ERROR,
        "No spreadsheet is bound. Bind this script to a spreadsheet or set SPREADSHEET_ID."
      )
    }
    return SpreadsheetApp.openById(key)
  },

  /**
   * @param {string} name
   * @returns {GoogleAppsScript.Spreadsheet.Sheet|null}
   */
  sheetByName: function (name) {
    return Sheets.getSpreadsheet().getSheetByName(name)
  },

  /**
   * Returns the existing sheet or creates it.
   *
   * @param {string} name
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  ensureSheet: function (name) {
    var existing = Sheets.sheetByName(name)
    return existing || Sheets.getSpreadsheet().insertSheet(name)
  },

  /**
   * Returns the full used range, including the header row.
   *
   * @param {string} sheetName
   * @returns {Array<string[]>}
   */
  getValues: function (sheetName) {
    var sheet = Sheets.sheetByName(sheetName)
    if (!sheet) {
      throw new AppError(Responses.CODES.CONFIGURATION_ERROR, "Sheet not found: " + sheetName)
    }
    return sheet.getDataRange().getValues()
  },

  /**
   * Writes a single cell.
   *
   * @param {string} sheetName
   * @param {number} row - 1-based row.
   * @param {number} column - 1-based column.
   * @param {*} value
   */
  setCell: function (sheetName, row, column, value) {
    Sheets.ensureSheet(sheetName).getRange(row, column).setValue(value)
  },

  /**
   * Permanently removes a row. Used for hard deletes only.
   *
   * @param {string} sheetName
   * @param {number} row - 1-based row. The header row is never removed.
   */
  deleteRow: function (sheetName, row) {
    var sheet = Sheets.sheetByName(sheetName)
    if (!sheet || row < Config.ROW_START) return
    sheet.deleteRow(row)
  },

  /**
   * Appends a row to the given sheet, creating the sheet if needed.
   *
   * @param {string} sheetName
   * @param {*[]} values
   */
  appendRow: function (sheetName, values) {
    Sheets.ensureSheet(sheetName).appendRow(values)
  },

  /**
   * Writes headers on a fresh sheet only (does not touch existing data).
   *
   * @param {string} sheetName
   * @param {string[]} headers
   */
  writeHeaders: function (sheetName, headers) {
    var sheet = Sheets.ensureSheet(sheetName)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers)
    }
  },

  /**
   * Ensures the header row contains at least the given headers, appending
   * any missing trailing columns. Existing headers and data are preserved,
   * so pre-migration sheets gain the new columns without data loss.
   *
   * @param {string} sheetName
   * @param {string[]} headers
   */
  ensureHeaders: function (sheetName, headers) {
    var sheet = Sheets.ensureSheet(sheetName)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers)
      return
    }
    var current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    var missing = []
    for (var i = 0; i < headers.length; i++) {
      if (current[i] === undefined || String(current[i]).trim() === "") {
        missing.push({ column: i + 1, value: headers[i] })
      }
    }
    for (var j = 0; j < missing.length; j++) {
      sheet.getRange(1, missing[j].column).setValue(missing[j].value)
    }
  },

  /**
   * Number of data rows (all rows below the header row).
   *
   * @param {string} sheetName
   * @returns {number}
   */
  dataRowCount: function (sheetName) {
    var sheet = Sheets.sheetByName(sheetName)
    if (!sheet) return 0
    return Math.max(0, sheet.getLastRow() - 1)
  },

  /**
   * Finds the first row whose cell matches the value.
   *
   * @param {string} sheetName
   * @param {number} columnIndex - 0-based column.
   * @param {*} value
   * @returns {number} 1-based row number, or -1 when not found.
   */
  findRowByValue: function (sheetName, columnIndex, value) {
    var data = Sheets.getValues(sheetName)
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      if (String(data[i][columnIndex]).trim() === String(value).trim()) {
        return i + 1
      }
    }
    return -1
  },

  /**
   * Reads the value of a single cell.
   *
   * @param {string} sheetName
   * @param {number} row - 1-based row.
   * @param {number} column - 1-based column.
   * @returns {*}
   */
  getCell: function (sheetName, row, column) {
    var sheet = Sheets.sheetByName(sheetName)
    if (!sheet || row <= 0) return ""
    return sheet.getRange(row, column).getValue()
  },
}