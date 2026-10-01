/**
 * Event registry operations.
 *
 * The Events sheet holds one row per event and each event owns a dedicated
 * attendance sheet named after its Event ID.
 */
var Events = {
  /**
   * @returns {SchoolEvent[]}
   */
  all: function () {
    if (!Sheets.sheetByName(Config.EVENTS_SHEET)) return []
    var data = Sheets.getValues(Config.EVENTS_SHEET)
    var events = []
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      var event = Models.eventFromRow(data[i])
      if (event) events.push(event)
    }
    return events
  },

  /**
   * Single bulk read, then an in-memory scan for the row.
   *
   * This previously called findRowByValue (a full getValues) and then
   * getValues again, reading the whole registry twice per lookup. It runs
   * on every check-in step, so the duplicate read doubled that cost.
   *
   * @param {string} eventId
   * @returns {SchoolEvent|null}
   */
  getById: function (eventId) {
    var data = Sheets.getValues(Config.EVENTS_SHEET)
    var target = String(eventId || "").trim()
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      if (String(data[i][Config.COLUMNS.EVENTS.ID] || "").trim() === target) {
        return Models.eventFromRow(data[i])
      }
    }
    return null
  },

  /**
   * @param {string} eventId
   * @returns {SchoolEvent}
   */
  assertById: function (eventId) {
    var event = Events.getById(eventId)
    if (!event) throw new AppError(Responses.CODES.EVENT_NOT_FOUND, "Event not found.")
    return event
  },

  /**
   * Throws unless the event currently accepts attendance.
   *
   * @param {SchoolEvent} event
   */
  assertCanRecord: function (event) {
    if (event.status === Config.STATUS_ACTIVE) return
    if (event.status === Config.STATUS_CLOSED) {
      throw new AppError(
        Responses.CODES.EVENT_NOT_ACTIVE,
        "The event is closed and no longer accepts attendance."
      )
    }
    throw new AppError(Responses.CODES.EVENT_NOT_ACTIVE, "The event is not active yet.")
  },

  /**
   * Creates an event, its registry row, and its attendance sheet.
   * Location and description are optional and default to "".
   *
   * A script lock serializes concurrent creations so two simultaneous
   * calls cannot claim the same Event ID.
   *
   * orgId is optional: the event form does not collect one yet, so a blank
   * reference is a legitimate "no organization". A non-empty one must resolve,
   * or the create fails with ORG_NOT_FOUND rather than attaching the event to
   * nothing. `time` is free text stored verbatim for the report.
   *
   * @param {string} name
   * @param {string} date
   * @param {string} [location]
   * @param {string} [description]
   * @param {string} [orgId]
   * @param {string} [time]
   * @returns {SchoolEvent}
   */
  create: function (name, date, location, description, orgId, time) {
    // Validated before anything is written: the attendance sheet is created
    // below, so rejecting afterwards would leave an orphan EVT-XXX tab behind.
    var owner = Organizations.assertOptional(orgId)
    var lock = LockService.getScriptLock()
    lock.waitLock(10000)
    try {
      var id = Events.nextIdAfterEnsuringRegistry()
      Sheets.writeHeaders(id, Config.ATTENDANCE_HEADERS)
      var row = [
        id,
        name,
        date,
        Config.DEFAULT_EVENT_STATUS,
        id,
        location || "",
        description || "",
        owner,
        time || "",
      ]
      Sheets.appendRow(Config.EVENTS_SHEET, row)
      return Models.eventFromRow(row)
    } finally {
      lock.releaseLock()
    }
  },

  /**
   * Ensures the Events registry exists before scanning it for the next ID,
   * so the very first event can be created on a fresh spreadsheet.
   *
   * @returns {string} The next available Event ID.
   */
  nextIdAfterEnsuringRegistry: function () {
    Sheets.ensureHeaders(Config.EVENTS_SHEET, Config.EVENTS_HEADERS)
    return Events.nextId()
  },

  /**
   * Updates mutable event fields. Only keys present in the patch are
   * changed; omitted keys keep their values. Status accepts any of the
   * configured statuses, which also makes this the supported path for
   * reopening a closed event. The attendance sheet is never touched.
   *
   * @param {string} eventId
   * @param {Object} patch - May contain name, date, location, description, status, orgId, time.
   * @returns {SchoolEvent}
   */
  update: function (eventId, patch) {
    var event = Events.assertById(eventId)
    var row = Sheets.findRowByValue(Config.EVENTS_SHEET, Config.COLUMNS.EVENTS.ID, eventId)
    var columns = Config.COLUMNS.EVENTS
    if (patch.name !== undefined) {
      event.name = Validators.requireString(patch, "name", "Event name", Config.MAX_EVENT_NAME_LENGTH)
    }
    if (patch.date !== undefined) {
      event.date = Validators.normalizeDate(patch.date)
    }
    if (patch.location !== undefined) {
      event.location = Validators.optionalString(patch, "location", "Event location", Config.MAX_EVENT_LOCATION_LENGTH)
    }
    if (patch.description !== undefined) {
      event.description = Validators.optionalString(patch, "description", "Event description", Config.MAX_EVENT_DESCRIPTION_LENGTH)
    }
    if (patch.status !== undefined) {
      event.status = Events.normalizeStatus(patch.status)
    }
    if (patch.orgId !== undefined) {
      event.orgId = Organizations.assertOptional(patch.orgId)
    }
    if (patch.time !== undefined) {
      event.time = Validators.optionalString(patch, "time", "Event time", Config.MAX_EVENT_TIME_LENGTH)
    }
    Sheets.setCell(Config.EVENTS_SHEET, row, columns.NAME + 1, event.name)
    Sheets.setCell(Config.EVENTS_SHEET, row, columns.DATE + 1, event.date)
    Sheets.setCell(Config.EVENTS_SHEET, row, columns.STATUS + 1, event.status)
    Sheets.setCell(Config.EVENTS_SHEET, row, columns.LOCATION + 1, event.location)
    Sheets.setCell(Config.EVENTS_SHEET, row, columns.DESCRIPTION + 1, event.description)
    Sheets.setCell(Config.EVENTS_SHEET, row, columns.ORG_ID + 1, event.orgId)
    Sheets.setCell(Config.EVENTS_SHEET, row, columns.TIME + 1, event.time)
    return event
  },

  /**
   * @param {*} status
   * @returns {string}
   */
  normalizeStatus: function (status) {
    var allowed = [Config.STATUS_UPCOMING, Config.STATUS_ACTIVE, Config.STATUS_CLOSED]
    for (var i = 0; i < allowed.length; i++) {
      if (typeof status === "string" && status.trim().toLowerCase() === allowed[i].toLowerCase()) {
        return allowed[i]
      }
    }
    throw new AppError(
      Responses.CODES.INVALID_REQUEST,
      "Event status is invalid. Use Upcoming, Active, or Closed."
    )
  },

  /**
   * Assembles the next Event ID by scanning existing IDs and incrementing
   * the highest numeric suffix, e.g. EVT-003 -> EVT-004.
   *
   * @returns {string}
   */
  nextId: function () {
    var events = Events.all()
    var maxSequence = 0
    for (var i = 0; i < events.length; i++) {
      var match = /^EVT-(\d+)$/i.exec(events[i].id)
      if (match) maxSequence = Math.max(maxSequence, Number(match[1]))
    }
    var next = String(maxSequence + 1)
    while (next.length < Config.ID_MIN_DIGITS) next = "0" + next
    return Config.ID_PREFIX + "-" + next
  },

  /**
   * Marks an event as Closed. Attendance records are preserved.
   *
   * @param {string} eventId
   * @returns {SchoolEvent}
   */
  close: function (eventId) {
    var event = Events.assertById(eventId)
    if (event.status === Config.STATUS_CLOSED) return event
    var row = Sheets.findRowByValue(Config.EVENTS_SHEET, Config.COLUMNS.EVENTS.ID, eventId)
    Sheets.setCell(Config.EVENTS_SHEET, row, Config.COLUMNS.EVENTS.STATUS + 1, Config.STATUS_CLOSED)
    event.status = Config.STATUS_CLOSED
    return event
  },

  /**
   * Marks an event as Active so it starts accepting attendance.
   * Closed events cannot be reopened; attendance records are never touched.
   *
   * @param {string} eventId
   * @returns {SchoolEvent}
   */
  open: function (eventId) {
    var event = Events.assertById(eventId)
    if (event.status === Config.STATUS_ACTIVE) return event
    if (event.status === Config.STATUS_CLOSED) {
      throw new AppError(
        Responses.CODES.EVENT_NOT_ACTIVE,
        "The event is closed and cannot be reopened."
      )
    }
    var row = Sheets.findRowByValue(Config.EVENTS_SHEET, Config.COLUMNS.EVENTS.ID, eventId)
    Sheets.setCell(Config.EVENTS_SHEET, row, Config.COLUMNS.EVENTS.STATUS + 1, Config.STATUS_ACTIVE)
    event.status = Config.STATUS_ACTIVE
    return event
  },

  /**
   * API handler for "getEvents".
   *
   * @returns {Object}
   */
  handleList: function () {
    return Responses.ok("Events retrieved successfully.", { events: Events.all() })
  },

  /**
   * API handler for "getEvent".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleGet: function (body) {
    var eventId = Validators.requireString(body, "eventId", "Event ID")
    return Responses.ok("Event retrieved successfully.", { event: Events.assertById(eventId) })
  },

  /**
   * API handler for "createEvent".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleCreate: function (body) {
    var name = Validators.requireString(body, "name", "Event name", Config.MAX_EVENT_NAME_LENGTH)
    var date = Validators.normalizeDate(body.date)
    var location = Validators.optionalString(body, "location", "Event location", Config.MAX_EVENT_LOCATION_LENGTH)
    var description = Validators.optionalString(body, "description", "Event description", Config.MAX_EVENT_DESCRIPTION_LENGTH)
    var orgId = Validators.optionalString(body, "orgId", "Organization ID", Config.MAX_ORG_ID_LENGTH)
    var time = Validators.optionalString(body, "time", "Event time", Config.MAX_EVENT_TIME_LENGTH)
    return Responses.ok("Event created successfully.", {
      event: Events.create(name, date, location, description, orgId, time),
    })
  },

  /**
   * API handler for "closeEvent".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleClose: function (body) {
    var eventId = Validators.requireString(body, "eventId", "Event ID")
    return Responses.ok("Event closed successfully.", { event: Events.close(eventId) })
  },

  /**
   * API handler for "openEvent".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleOpen: function (body) {
    var eventId = Validators.requireString(body, "eventId", "Event ID")
    return Responses.ok("Event opened successfully.", { event: Events.open(eventId) })
  },

  /**
   * API handler for "updateEvent". Accepts any subset of name, date,
   * location, description, and status; rejects unknown keys so typos
   * fail loudly instead of being silently ignored.
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleUpdate: function (body) {
    var eventId = Validators.requireString(body, "eventId", "Event ID")
    var allowed = ["name", "date", "location", "description", "status", "orgId", "time"]
    var patch = {}
    for (var key in body) {
      // secret/adminKey/action/eventId are envelope fields, not patch keys.
      if (key === "secret" || key === "adminKey" || key === "action" || key === "eventId") continue
      if (allowed.indexOf(key) < 0) {
        throw new AppError(Responses.CODES.INVALID_REQUEST, "Unknown field: " + key)
      }
      patch[key] = body[key]
    }
    return Responses.ok("Event updated successfully.", {
      event: Events.update(eventId, patch),
    })
  },
}