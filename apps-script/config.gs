/**
 * Central configuration for the School Event Attendance System.
 *
 * This module is the single place where sheet names, column layouts,
 * statuses and limits are defined. Everything else in the backend reads
 * these values instead of hardcoding spreadsheet addresses.
 */
var Config = {
  MASTERLIST_SHEET: "Masterlist",
  EVENTS_SHEET: "Events",
  ORGANIZATIONS_SHEET: "Organizations",

  MASTERLIST_HEADERS: ["SRCODE", "Full Name", "College", "Program", "Year Level", "Gender"],
  // Org ID and Time are appended at the end so `ensureHeaders` can add them
  // to a live Events sheet without touching the columns that already hold data.
  EVENTS_HEADERS: [
    "Event ID",
    "Event Name",
    "Event Date",
    "Status",
    "Sheet Name",
    "Location",
    "Description",
    "Org ID",
    "Time",
  ],
  ORGANIZATIONS_HEADERS: ["Org ID", "Org Name", "Email"],
  ATTENDANCE_HEADERS: ["Timestamp", "SRCODE"],

  STATUS_UPCOMING: "Upcoming",
  STATUS_ACTIVE: "Active",
  STATUS_CLOSED: "Closed",

  DATE_FORMAT: "MM/dd/yyyy",
  TIME_FORMAT: "MM/dd/yyyy HH:mm:ss",

  ID_PREFIX: "EVT",
  ORG_ID_PREFIX: "ORG",
  ID_MIN_DIGITS: 3,

  DEFAULT_EVENT_STATUS: "Upcoming",
  ROW_START: 2,

  MAX_SRCODE_LENGTH: 20,
  MAX_EVENT_NAME_LENGTH: 150,
  MAX_EVENT_LOCATION_LENGTH: 150,
  MAX_EVENT_DESCRIPTION_LENGTH: 500,
  // Free text, not a parsed duration: the report prints whatever was typed
  // (e.g. "12:00 pm - 5:00 pm"), so the cap is generous and never normalized.
  MAX_EVENT_TIME_LENGTH: 100,
  MAX_ORG_ID_LENGTH: 20,
  MAX_ORG_NAME_LENGTH: 150,
  MAX_ORG_EMAIL_LENGTH: 150,

  SECRET_PROPERTY: "APPS_SCRIPT_SECRET",
  ADMIN_KEY_PROPERTY: "ADMIN_SERVICE_KEY",
  SPREADSHEET_KEY_PROPERTY: "SPREADSHEET_ID",

  COLUMNS: {
    MASTERLIST: {
      SRCODE: 0,
      FULL_NAME: 1,
      COLLEGE: 2,
      PROGRAM: 3,
      YEAR_LEVEL: 4,
      GENDER: 5,
    },
    EVENTS: {
      ID: 0,
      NAME: 1,
      DATE: 2,
      STATUS: 3,
      SHEET_NAME: 4,
      LOCATION: 5,
      DESCRIPTION: 6,
      ORG_ID: 7,
      TIME: 8,
    },
    ORGANIZATIONS: {
      ID: 0,
      NAME: 1,
      EMAIL: 2,
    },
    ATTENDANCE: {
      TIMESTAMP: 0,
      SRCODE: 1,
    },
  },
}