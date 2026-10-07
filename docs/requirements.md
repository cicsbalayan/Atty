# School Event Attendance System

## 1. Project Overview

The School Event Attendance System is a web-based attendance management system built using **Next.js**, **Google Apps Script**, and **Google Sheets**.

The system is designed for managing student attendance across multiple school events. The existing Google Sheets file will serve as the system's data storage, while Google Apps Script will act as the backend/API layer and Next.js will provide the web interface.

The system will maintain a centralized `Masterlist` containing student information and an `Events` sheet containing event records. Each event will have its own dynamically created attendance sheet.

The system will avoid duplicating student information across event attendance sheets. Student information will remain in the `Masterlist`, while event sheets will store only attendance-related data.

---

# 2. Technology Stack

## 2.1 Frontend

**Next.js**

Next.js will be responsible for:

* User interface
* Event management interface
* Attendance interface
* Student lookup interface
* Attendance dashboard
* Attendance reports
* Communication with the Apps Script backend

---

## 2.2 Backend

**Google Apps Script**

Google Apps Script will function as the backend/API layer.

It will be responsible for:

* Receiving requests from Next.js
* Validating requests
* Searching the Masterlist
* Creating events
* Creating event attendance sheets
* Recording attendance
* Preventing duplicate attendance
* Retrieving attendance records
* Generating attendance data for reports

The Apps Script project will be deployed as a **Web App**.

Next.js will communicate with the Apps Script Web App using HTTP requests.

---

## 2.3 Data Storage

**Google Sheets**

Google Sheets will serve as the primary data storage system.

The spreadsheet will contain:

* `Masterlist`
* `Events`
* Dynamically generated event attendance sheets

The system will use Apps Script's spreadsheet services to read and modify the Google Sheets data.

The Google Sheets API will not be required for the initial implementation.

---

# 3. System Architecture

The system shall follow this architecture:

```text
┌───────────────────────────┐
│          Next.js          │
│                           │
│  Event Management         │
│  Attendance Interface     │
│  Dashboard                │
│  Reports                  │
└─────────────┬─────────────┘
              │
              │ HTTPS
              ▼
┌───────────────────────────┐
│     Google Apps Script    │
│                           │
│       Web App / API       │
│                           │
│  Request Validation       │
│  Student Lookup           │
│  Event Management         │
│  Attendance Processing    │
└─────────────┬─────────────┘
              │
              │ Spreadsheet Services
              ▼
┌───────────────────────────┐
│       Google Sheets       │
│                           │
│  Masterlist               │
│  Events                   │
│  EVT-001                  │
│  EVT-002                  │
│  EVT-003                  │
└───────────────────────────┘
```

---

# 4. Objectives

The system shall:

* Provide a centralized student masterlist.
* Use `SRCODE` as the unique student identifier.
* Allow users to create multiple school events.
* Dynamically create attendance sheets for newly created events.
* Allow students to record attendance using their SRCODE.
* Validate SRCODE values against the Masterlist.
* Prevent duplicate attendance within the same event.
* Automatically record attendance timestamps.
* Keep student information separate from attendance records.
* Provide attendance information and reports.
* Provide a web-based interface through Next.js.
* Use Google Apps Script as the backend/API layer.
* Use Google Sheets as the primary data store.

---

# 5. Spreadsheet Requirements

## 5.1 Masterlist

The `Masterlist` sheet shall contain the centralized student information.

### Columns

| Column | Field      |
| ------ | ---------- |
| A      | SRCODE     |
| B      | Full Name  |
| C      | College    |
| D      | Program    |
| E      | Year Level |
| F      | Gender     |

Example:

| SRCODE   | Full Name      | College | Program | Year Level | Gender |
| -------- | -------------- | ------- | ------- | ---------- | ------ |
| 26-12345 | Juan Dela Cruz | CICS    | BSIT    | First Year | Male   |
| 26-12346 | Maria Santos   | CICS    | BSIT    | First Year | Female |

### Requirements

* `SRCODE` shall be the unique identifier of a student.
* Each SRCODE should correspond to one student.
* Student information shall be maintained only in the Masterlist.
* Event attendance sheets shall not permanently duplicate student information.

---

# 6. Events Sheet

The `Events` sheet shall serve as the event registry.

### Columns

| Column | Field      | Description                                |
| ------ | ---------- | ------------------------------------------ |
| A      | Event ID   | Unique identifier of the event             |
| B      | Event Name | Name of the event                          |
| C      | Event Date | Date of the event                          |
| D      | Status     | Current event status                       |
| E      | Sheet Name | Attendance sheet associated with the event |

Example:

| Event ID | Event Name            | Event Date | Status   | Sheet Name |
| -------- | --------------------- | ---------- | -------- | ---------- |
| EVT-001  | Freshmen Orientation  | 09/20/2026 | Active   | EVT-001    |
| EVT-002  | CICS General Assembly | 09/25/2026 | Upcoming | EVT-002    |

### Event Status

The system shall support the following statuses:

* `Upcoming`
* `Active`
* `Closed`

Only `Active` events shall accept new attendance records.

---

# 7. Dynamic Event Sheets

The system shall dynamically create a new Google Sheets tab whenever a new event is created.

For example:

```text
Masterlist
Events
EVT-001
EVT-002
EVT-003
```

The event sheet name shall use the generated Event ID instead of the full event name.

This avoids issues caused by:

* Duplicate event names
* Long event names
* Invalid sheet-name characters
* Changes to event names

---

## 7.1 Event Attendance Structure

Each dynamically created event sheet shall contain:

| Column | Field     |
| ------ | --------- |
| A      | Timestamp |
| B      | SRCODE    |

Example:

| Timestamp           | SRCODE   |
| ------------------- | -------- |
| 09/20/2026 08:01:23 | 26-12345 |
| 09/20/2026 08:03:17 | 26-12346 |

The event sheet shall not contain permanent copies of:

* Full Name
* College
* Program
* Year Level
* Gender

These values remain in the `Masterlist`.

---

# 8. Functional Requirements

## FR-01: Masterlist Lookup

The system shall allow Apps Script to search the `Masterlist` using a student's SRCODE.

When a valid SRCODE is provided, the system shall retrieve the student's information.

Example:

```text
SRCODE: 26-12345

↓
Masterlist Lookup

Full Name: Juan Dela Cruz
College: CICS
Program: BSIT
Year Level: First Year
Gender: Male
```

If the SRCODE does not exist, the system shall reject the attendance request.

---

## FR-02: Event Creation

The Next.js application shall provide an interface for creating an event.

The user shall provide:

* Event Name
* Event Date

The backend shall automatically generate a unique Event ID.

Example:

```text
EVT-001
EVT-002
EVT-003
```

---

## FR-03: Dynamic Sheet Creation

When an event is successfully created:

1. Apps Script shall generate an Event ID.
2. Apps Script shall add the event to the `Events` sheet.
3. Apps Script shall create a new Google Sheets tab.
4. The new sheet shall use the Event ID as its name.
5. The sheet shall be initialized with the attendance headers.
6. The event shall become available to the Next.js application.

---

## FR-04: Event Retrieval

Next.js shall be able to request the list of events from Apps Script.

The system shall be able to display:

* Event Name
* Event Date
* Event Status
* Event ID

Example:

```text
Freshmen Orientation
September 20, 2026
Active

[ Take Attendance ]
```

---

## FR-05: Attendance Recording

The attendance interface shall allow a user to enter or scan a student's SRCODE.

The request shall contain:

```json
{
  "action": "recordAttendance",
  "eventId": "EVT-001",
  "srcode": "26-12345"
}
```

Apps Script shall:

1. Validate the event.
2. Check the event status.
3. Search the Masterlist.
4. Verify the SRCODE.
5. Check for an existing attendance record.
6. Record the timestamp and SRCODE if valid.

---

## FR-06: Duplicate Attendance Prevention

The system shall prevent a student from being recorded more than once for the same event.

The duplicate check shall use:

```text
Event ID + SRCODE
```

Example:

```text
EVT-001 + 26-12345
```

If an existing record is found, the system shall return an appropriate response instead of adding another row.

Example:

```json
{
  "success": false,
  "message": "Student has already attended this event."
}
```

---

## FR-07: Attendance Timestamp

When attendance is successfully recorded, Apps Script shall automatically generate the timestamp.

The Next.js client shall not be responsible for generating the official attendance timestamp.

Example:

```text
09/20/2026 08:01:23
```

---

## FR-08: Closed Events

When an event is marked as `Closed`:

* New attendance records shall not be accepted.
* Existing attendance records shall remain available.
* Attendance reports shall remain accessible.

---

## FR-09: Multiple Events

The system shall support multiple events using the same Masterlist.

A student may attend multiple different events.

Example:

```text
EVT-001 + 26-12345 → Present
EVT-002 + 26-12345 → Present
EVT-003 + 26-12345 → Present
```

These shall be treated as separate attendance records.

---

## FR-10: Attendance Reporting

The system shall provide attendance information based on the selected event.

Reports may include:

* Total students in the Masterlist
* Total students present
* Students not yet recorded
* Attendance percentage
* Attendance by college
* Attendance by program
* Attendance by year level
* Attendance by gender

The system shall retrieve student information from the Masterlist when generating these reports.

---

# 9. Next.js Requirements

The Next.js application shall provide the user interface for the system.

## 9.1 Dashboard

The dashboard shall display:

* Active events
* Upcoming events
* Closed events
* Basic attendance statistics

---

## 9.2 Event Management

The application shall provide:

* Create Event
* View Events
* Open Event
* Close Event
* View Event Attendance

---

## 9.3 Attendance Interface

The attendance page shall provide:

* Event information
* SRCODE input
* Attendance confirmation
* Student identification result
* Duplicate attendance notification
* Invalid SRCODE notification

Example:

```text
┌─────────────────────────────────────┐
│       FRESHMEN ORIENTATION          │
│                                     │
│       Enter / Scan SRCODE           │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 26-12345                      │  │
│  └───────────────────────────────┘  │
│                                     │
│            [ CHECK IN ]             │
│                                     │
│  ✓ Attendance Recorded              │
│                                     │
│  Juan Dela Cruz                     │
│  BSIT - First Year                  │
└─────────────────────────────────────┘
```

---

# 10. Apps Script API Requirements

Google Apps Script shall expose the functionality required by the Next.js application through a Web App.

The API shall support operations such as:

```text
getEvents
createEvent
getEvent
recordAttendance
checkAttendance
getAttendance
getAttendanceReport
closeEvent
```

The API may use a request structure similar to:

```json
{
  "action": "recordAttendance",
  "eventId": "EVT-001",
  "srcode": "26-12345"
}
```

The API shall return JSON responses.

Example successful response:

```json
{
  "success": true,
  "message": "Attendance recorded successfully.",
  "student": {
    "srcode": "26-12345",
    "name": "Juan Dela Cruz"
  }
}
```

Example failed response:

```json
{
  "success": false,
  "message": "SRCODE not found."
}
```

---

# 11. API Security

The Apps Script Web App shall not expose sensitive Google credentials to the Next.js client.

The Next.js application shall communicate with the Apps Script Web App through HTTPS.

An application-level secret is recommended for requests between the Next.js server and Apps Script.

The secret shall:

* Be stored as an environment variable in the Next.js server environment.
* Be stored as a Script Property in Apps Script.
* Never be exposed in client-side JavaScript.
* Be validated by Apps Script before processing protected operations.

Example Next.js environment variables:

```env
APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
APPS_SCRIPT_SECRET=your-server-side-secret
```

The Apps Script Web App URL itself shall not be treated as a secret.

---

# 12. Data Flow

## 12.1 Creating an Event

```text
Next.js
   ↓
User enters event information
   ↓
Next.js Server
   ↓
Apps Script Web App
   ↓
Generate Event ID
   ↓
Add event to Events sheet
   ↓
Create event attendance sheet
   ↓
Return event information
   ↓
Next.js
```

---

## 12.2 Recording Attendance

```text
Student / Staff
      ↓
Next.js Attendance Interface
      ↓
SRCODE
      ↓
Next.js Server
      ↓
Apps Script Web App
      ↓
Check Event
      ↓
Search Masterlist
      ↓
Validate SRCODE
      ↓
Check Event Attendance Sheet
      ↓
Duplicate?
   ↙       ↘
 YES       NO
  ↓         ↓
Reject    Record
            ↓
       Timestamp + SRCODE
            ↓
        Google Sheets
```

---

# 13. Non-Functional Requirements

## NFR-01: Usability

The system shall provide a simple and intuitive interface suitable for school personnel.

Attendance recording should require minimal interaction.

---

## NFR-02: Performance

The system should process a normal attendance request within a reasonable response time.

Apps Script operations should minimize unnecessary spreadsheet reads and writes.

---

## NFR-03: Reliability

Successfully recorded attendance shall remain stored in Google Sheets.

Closing an event shall not delete its attendance records.

---

## NFR-04: Data Integrity

The system shall:

* Validate SRCODE values.
* Prevent duplicate attendance.
* Validate event IDs.
* Validate event status.
* Maintain a single source of truth for student information.

---

## NFR-05: Maintainability

The system shall separate:

```text
Student Data
     ↓
Masterlist

Event Data
     ↓
Events

Attendance Data
     ↓
EVT-XXX sheets
```

Changes to student information shall only need to be made in the Masterlist.

---

## NFR-06: Scalability

The system shall allow additional events to be created without modifying the Apps Script source code for each event.

The same backend logic shall handle all events.

---

## NFR-07: Security

Google Sheets access shall be restricted to authorized users.

Sensitive credentials and application secrets shall not be exposed through the Next.js client.

---

# 14. Spreadsheet Structure

The final spreadsheet shall follow this structure:

```text
School Event Attendance System
│
├── Masterlist
│
├── Events
│
├── EVT-001
│
├── EVT-002
│
├── EVT-003
│
└── ...
```

### Masterlist

```text
SRCODE | Full Name | College | Program | Year Level | Gender
```

### Events

```text
Event ID | Event Name | Event Date | Status | Sheet Name
```

### Event Attendance

```text
Timestamp | SRCODE
```

---

# 15. Deployment Requirements

## Next.js

The Next.js application may be deployed using a hosting platform such as Vercel.

The application shall store the Apps Script Web App URL and application secret as server-side environment variables.

---

## Google Apps Script

The Apps Script project shall:

1. Be connected to the Google Sheets spreadsheet.
2. Implement the required API functions.
3. Be deployed as a Web App.
4. Have the required Google Sheets permissions.
5. Validate incoming requests.
6. Return JSON responses.

---

# 16. Constraints

The initial implementation shall:

* Use Google Sheets as the data store.
* Use Google Apps Script as the backend/API.
* Use Next.js as the frontend.
* Avoid requiring a separate database.
* Avoid directly integrating the Google Sheets API into Next.js.
* Avoid duplicating student information in event sheets.
* Dynamically create event sheets through Apps Script.

---
