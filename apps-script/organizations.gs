/**
 * Organization registry operations.
 *
 * Organizations are the entities that use the attendance tracker. Each one
 * owns the letterhead identity a report needs — name and email — so a new
 * customer no longer requires a code change. The Events sheet references an
 * organization by ID; see `Events.create` for why that reference is optional.
 *
 * Structured as a mirror of `events.gs`: bulk reads, an in-memory scan for
 * lookups, and a script lock around ID assignment so two simultaneous creates
 * cannot claim the same number.
 */
var Organizations = {
  /**
   * @returns {Organization[]}
   */
  all: function () {
    if (!Sheets.sheetByName(Config.ORGANIZATIONS_SHEET)) return []
    var data = Sheets.getValues(Config.ORGANIZATIONS_SHEET)
    var organizations = []
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      var organization = Models.organizationFromRow(data[i])
      if (!organization) continue
      organizations.push(organization)
    }
    return organizations
  },

  /**
   * Single bulk read, then an in-memory scan for the row.
   *
   * @param {string} orgId
   * @returns {Organization|null}
   */
  getById: function (orgId) {
    var target = String(orgId || "").trim()
    if (!target) return null
    var data = Sheets.getValues(Config.ORGANIZATIONS_SHEET)
    for (var i = Config.ROW_START - 1; i < data.length; i++) {
      if (String(data[i][Config.COLUMNS.ORGANIZATIONS.ID] || "").trim() === target) {
        return Models.organizationFromRow(data[i])
      }
    }
    return null
  },

  /**
   * @param {string} orgId
   * @returns {Organization}
   */
  assertById: function (orgId) {
    var organization = Organizations.getById(orgId)
    if (!organization) {
      throw new AppError(Responses.CODES.ORG_NOT_FOUND, "Organization not found.")
    }
    return organization
  },

  /**
   * Validates an org reference, treating a blank value as "no organization".
   *
   * The event form does not collect an organization yet, so an empty
   * reference is legitimate rather than an error. A non-empty one must resolve,
   * which is what stops a typo from silently attaching an event to nothing.
   *
   * @param {string} orgId
   */
  assertOptional: function (orgId) {
    var target = String(orgId || "").trim()
    if (!target) return ""
    Organizations.assertById(target)
    return target
  },

  /**
   * Creates an organization row. Only the name is required; the email
   * defaults to "" so a minimal record is still report-ready.
   *
   * @param {string} name
   * @param {string} [email]
   * @returns {Organization}
   */
  create: function (name, email) {
    var lock = LockService.getScriptLock()
    lock.waitLock(10000)
    try {
      Sheets.ensureHeaders(Config.ORGANIZATIONS_SHEET, Config.ORGANIZATIONS_HEADERS)
      var row = [Organizations.nextId(), name, email || ""]
      Sheets.appendRow(Config.ORGANIZATIONS_SHEET, row)
      return Models.organizationFromRow(row)
    } finally {
      lock.releaseLock()
    }
  },

  /**
   * Updates mutable organization fields. Only keys present in the patch are
   * changed; omitted keys keep their values.
   *
   * @param {string} orgId
   * @param {Object} patch - May contain name and email.
   * @returns {Organization}
   */
  update: function (orgId, patch) {
    var organization = Organizations.assertById(orgId)
    var row = Sheets.findRowByValue(
      Config.ORGANIZATIONS_SHEET,
      Config.COLUMNS.ORGANIZATIONS.ID,
      orgId
    )
    var columns = Config.COLUMNS.ORGANIZATIONS
    if (patch.name !== undefined) {
      organization.name = Validators.requireString(
        patch,
        "name",
        "Organization name",
        Config.MAX_ORG_NAME_LENGTH
      )
    }
    if (patch.email !== undefined) {
      organization.email = Validators.optionalString(
        patch,
        "email",
        "Organization email",
        Config.MAX_ORG_EMAIL_LENGTH
      )
    }
    Sheets.setCell(Config.ORGANIZATIONS_SHEET, row, columns.NAME + 1, organization.name)
    Sheets.setCell(Config.ORGANIZATIONS_SHEET, row, columns.EMAIL + 1, organization.email)
    return organization
  },

  /**
   * Hard deletes an organization: the row is removed permanently.
   *
   * Events that reference the deleted ID keep their stored orgId string, but
   * the reference no longer resolves — their letterhead falls back to the
   * default and the event can no longer be re-validated against it. Only
   * delete an organization with no events attached.
   *
   * @param {string} orgId
   * @returns {Organization} Snapshot of the removed row.
   */
  delete: function (orgId) {
    var organization = Organizations.assertById(orgId)
    var row = Sheets.findRowByValue(
      Config.ORGANIZATIONS_SHEET,
      Config.COLUMNS.ORGANIZATIONS.ID,
      orgId
    )
    Sheets.deleteRow(Config.ORGANIZATIONS_SHEET, row)
    return organization
  },

  /**
   * Assembles the next Org ID by scanning existing IDs and incrementing the
   * highest numeric suffix, e.g. ORG-002 -> ORG-003.
   *
   * Deletes are permanent, so an ID can be reused once the row holding the
   * highest number is removed. Only delete organizations with no events.
   *
   * @returns {string} The next available Org ID.
   */
  nextId: function () {
    var organizations = Organizations.all()
    var maxSequence = 0
    for (var i = 0; i < organizations.length; i++) {
      var match = /^ORG-(\d+)$/i.exec(organizations[i].id)
      if (match) maxSequence = Math.max(maxSequence, Number(match[1]))
    }
    var next = String(maxSequence + 1)
    while (next.length < Config.ID_MIN_DIGITS) next = "0" + next
    return Config.ORG_ID_PREFIX + "-" + next
  },

  /**
   * API handler for "getOrganizations".
   *
   * @returns {Object}
   */
  handleList: function () {
    return Responses.ok("Organizations retrieved successfully.", {
      organizations: Organizations.all(),
    })
  },

  /**
   * API handler for "getOrganization".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleGet: function (body) {
    var orgId = Validators.requireString(body, "orgId", "Organization ID", Config.MAX_ORG_ID_LENGTH)
    return Responses.ok("Organization retrieved successfully.", {
      organization: Organizations.assertById(orgId),
    })
  },

  /**
   * API handler for "createOrganization".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleCreate: function (body) {
    var name = Validators.requireString(body, "name", "Organization name", Config.MAX_ORG_NAME_LENGTH)
    var email = Validators.optionalString(body, "email", "Organization email", Config.MAX_ORG_EMAIL_LENGTH)
    return Responses.ok("Organization created successfully.", {
      organization: Organizations.create(name, email),
    })
  },

  /**
   * API handler for "deleteOrganization".
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleDelete: function (body) {
    var orgId = Validators.requireString(body, "orgId", "Organization ID", Config.MAX_ORG_ID_LENGTH)
    return Responses.ok("Organization deleted successfully.", {
      organization: Organizations.delete(orgId),
    })
  },

  /**
   * API handler for "updateOrganization". Accepts name and email; rejects
   * unknown keys so typos fail loudly instead of being silently ignored.
   *
   * @param {Object} body
   * @returns {Object}
   */
  handleUpdate: function (body) {
    var orgId = Validators.requireString(body, "orgId", "Organization ID", Config.MAX_ORG_ID_LENGTH)
    var allowed = ["name", "email"]
    var patch = {}
    for (var key in body) {
      // secret/adminKey/action/orgId are envelope fields, not patch keys.
      if (key === "secret" || key === "adminKey" || key === "action" || key === "orgId") continue
      if (allowed.indexOf(key) < 0) {
        throw new AppError(Responses.CODES.INVALID_REQUEST, "Unknown field: " + key)
      }
      patch[key] = body[key]
    }
    return Responses.ok("Organization updated successfully.", {
      organization: Organizations.update(orgId, patch),
    })
  },
}
