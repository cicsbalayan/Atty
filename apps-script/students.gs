/**
 * Masterlist operations: student lookup, counting, and indexing.
 *
 * The Masterlist sheet is the single source of truth for student data.
 * It is only ever read here; no student data is ever written into event
 * attendance sheets.
 */
/**
 * In-memory memo for the Masterlist index, held outside the Students object
 * so it is not enumerable on the namespace. Apps Script keeps globals alive
 * between invocations served by the same container, so a warm container does
 * zero Masterlist reads; a cold one re-reads once. The TTL keeps roster
 * edits from going unnoticed during a long-running event.
 */
var masterlistMemo = { index: null, at: 0 };

var Students = {
  /** How long a memoized index is reused, in milliseconds. */
  INDEX_TTL_MS: 5 * 60 * 1000,

  /** Memoized index state, exposed for tests. */
  memo: masterlistMemo,

  /**
   * @returns {Student[]}
   */
  all: function () {
    var data = Sheets.getValues(Config.MASTERLIST_SHEET)
    var students = []
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      var student = Models.studentFromRow(data[i])
      if (student.srcode) students.push(student)
    }
    return students
  },

  /**
   * Maps srcode -> Student for fast repeated lookups.
   *
   * The Masterlist is the largest sheet in the system, and this runs on
   * every validate and every record, so the index is memoized for the
   * lifetime of a warm script container.
   *
   * This deliberately does NOT use CacheService. CacheService reads are
   * network round trips, so a chunked index turned one bulk getValues()
   * into a sequential chain of cache gets and made check-in dramatically
   * slower - it exhausted the upstream request timeout. A module-level
   * memo costs nothing to read, has no 100KB value cap, and reduces the
   * Masterlist to at most one read per container per TTL window.
   *
   * A cold container simply re-reads once, so this can only be faster than
   * reading on every call.
   *
   * @returns {Object.<string, Student>}
   */
  index: function () {
    var now = new Date().getTime();
    if (Students.memo.index && now - Students.memo.at < Students.INDEX_TTL_MS) {
      return Students.memo.index;
    }
    var index = {};
    var students = Students.all();
    for (var i = 0; i < students.length; i++) {
      index[students[i].srcode] = students[i];
    }
    Students.memo.index = index;
    Students.memo.at = now;
    return index;
  },

  /**
   * Drops the memoized index so the next lookup re-reads the Masterlist.
   *
   * @returns {Object.<string, Student>}
   */
  refreshIndex: function () {
    Students.memo.index = null;
    Students.memo.at = 0;
    return Students.index();
  },

  /**
   * @param {string} srcode
   * @returns {Student|null}
   */
  getBySrcode: function (srcode) {
    return Students.index()[String(srcode || "").trim()] || null
  },

  /**
   * @returns {number}
   */
  count: function () {
    return Sheets.dataRowCount(Config.MASTERLIST_SHEET)
  },

  /**
   * Returns the student or throws when the srcode is unknown.
   *
   * @param {string} srcode
   * @returns {Student}
   */
  assertExists: function (srcode) {
    var student = Students.getBySrcode(srcode)
    if (!student) {
      throw new AppError(Responses.CODES.SRCODE_NOT_FOUND, "SRCODE not found in the Masterlist.")
    }
    return student
  },

  /**
   * API handler for "lookupStudent".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleLookup: function (body) {
    var srcode = Validators.requireString(body, "srcode", "SRCODE", Config.MAX_SRCODE_LENGTH)
    return Responses.ok("Student found.", { student: Students.assertExists(srcode) })
  },
}