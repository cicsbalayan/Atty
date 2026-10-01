/**
 * An organization is an entity that uses the attendance tracker. It owns the
 * identity a report letterhead needs, so a new customer is a data change
 * rather than a code change.
 *
 * Only `name` is required. The email defaults to "" so a minimal record is
 * still valid, and it is free text: the report prints it as typed.
 */
export interface Organization {
  id: string
  name: string
  email: string
}

export interface CreateOrganizationInput {
  name: string
  email?: string
}

export interface UpdateOrganizationInput {
  name?: string
  email?: string
}
