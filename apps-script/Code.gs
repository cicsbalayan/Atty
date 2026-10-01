/**
 * Web App entry point.
 *
 * All requests from Next.js arrive as JSON POST bodies of the form
 * { secret, adminKey, action, ...fields }. Each action maps to a handler below.
 *
 * Both credentials are verified before the action is even looked at, so an
 * unauthenticated caller cannot probe which action names exist.
 */
function doGet() {
  return Responses.json(
    Responses.fail(
      Responses.CODES.METHOD_NOT_ALLOWED,
      "This endpoint accepts JSON POST requests only."
    )
  )
}

function doPost(event) {
  try {
    var body = Validators.parseBody(event && event.postData ? event.postData.contents : "")
    Auth.verify(body.secret)
    Auth.verifyAdminKey(body.adminKey)
    var action = Validators.requireString(body, "action", "action")
    var handler = router()[action]
    if (!handler) {
      throw new AppError(Responses.CODES.INVALID_REQUEST, "Unknown action: " + action)
    }
    return Responses.json(handler(body))
  } catch (error) {
    if (error instanceof AppError) {
      return Responses.json(Responses.fail(error.code, error.message))
    }
    console.error("Unexpected error while handling request:", error)
    return Responses.json(
      Responses.fail(Responses.CODES.INTERNAL_ERROR, "An unexpected server error occurred.")
    )
  }
}

/**
 * Builds the action registry. Built lazily at call time so the script is
 * resilient to the order in which Apps Script loads its files.
 *
 * @returns {Object.<string, Function>}
 */
function router() {
  return {
    getOrganizations: Organizations.handleList,
    getOrganization: Organizations.handleGet,
    createOrganization: Organizations.handleCreate,
    updateOrganization: Organizations.handleUpdate,
    deleteOrganization: Organizations.handleDelete,
    getEvents: Events.handleList,
    getEvent: Events.handleGet,
    createEvent: Events.handleCreate,
    updateEvent: Events.handleUpdate,
    closeEvent: Events.handleClose,
    openEvent: Events.handleOpen,
    recordAttendance: Attendance.handleRecord,
    checkAttendance: Attendance.handleCheck,
    getAttendance: Attendance.handleList,
    getAttendanceReport: Reports.handleReport,
    lookupStudent: Students.handleLookup,
  }
}