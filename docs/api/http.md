# HTTP API

The Next.js app and `ClockedIn.Api` implement this contract. Paths are the same on both servers. A token is valid only on the server that issued it.

Instants are UTC ISO-8601. `occurredOn` is `YYYY-MM-DD`. Ids are UUIDs. Unknown JSON fields are ignored. Passwords, password hashes, and secret codes are never returned.

## Errors

```json
{ "code": "validation_error", "message": "..." }
```

| Status | code                       |
| ------ | -------------------------- |
| 400    | `validation_error`         |
| 401    | `unauthorized`             |
| 403    | `forbidden`                |
| 403    | `password_change_required` |
| 404    | `not_found`                |
| 405    | `method_not_allowed`       |
| 409    | `conflict`                 |
| 500    | `server_error`             |
| 502    | `email_failed`             |

A missing or invalid token returns 401 with `Authentication is required.`. A valid token whose user no longer exists returns 401 with `This token is not valid for this server.`. An unexpected failure returns 500 with `Something went wrong.`.

Lists are `{ "items": [], "limit": 50, "offset": 0 }`. `limit` defaults to 50 and must be 1 through 100. `offset` defaults to 0 and must be zero or greater.

Deletes return 204 with an empty body. Revoking an invitation returns 200 and the invitation.

### Request handling order

A request is checked in this order, and the first failure is returned:

1. Authentication (401).
2. The shape of the body and query (400). This covers types, required fields, lengths, formats, enum values, and rules between fields of the same request.
3. Existence and authorization (404 and 403).
4. Rules that need stored data (400). Examples: a tag, project, task category, or department must belong to the entry's organization, and project editors must be organization members.
5. Conflicts (409).

A request body must be a JSON object. An empty body is treated as `{}`. Anything else returns 400 `Request body must be JSON.`. An empty query parameter such as `?from=` is treated as absent.

Conflict messages:

| Message                                           | When                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `That username is already in use.`                | Duplicate username                                                                |
| `That email is already in use.`                   | Duplicate account email                                                           |
| `That sourceRef is already in use.`               | Duplicate time entry `sourceRef`                                                  |
| `A pending invite already exists for that email.` | Second pending invite for the same email and target                               |
| `That value is already in use.`                   | Any other unique name, such as a department, tag, task category, or project title |
| `Delete the time entries first.`                  | Deleting something that time entries still reference                              |
| `This record is still in use.`                    | Deleting something that other records still reference                             |

## Auth

Access tokens last 15 minutes and are HS256 JWTs. Claims are `sub` (user id), `email`, `username`, and `isSuperAdmin`. Issuer, audience, and signing key come from `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_SIGNING_KEY`. Send `Authorization: Bearer <accessToken>`.

Refresh tokens last 30 days. Only their hash is stored. Refresh rotates the refresh token. A second use of that same token within 2 minutes also returns a session, so overlapping requests keep the user signed in. After 2 minutes the old token is rejected. Logout and password changes reject the token immediately.

`POST /auth/user` (201) creates a user and profile and signs them in. `isSuperAdmin` cannot be set here.

```json
{
  "username": "",
  "email": "",
  "password": "",
  "firstName": "",
  "lastName": "",
  "displayName": null,
  "timezone": "UTC",
  "phone": null
}
```

`displayName`, `timezone`, and `phone` are optional. `timezone` is an IANA name and defaults to `UTC`.

`POST /auth/login` (200) body `{ "username": "", "password": "" }`. A user created with a temporary password has `mustChangePassword: true`. They can sign in, call `GET /users/me`, change the password with `PATCH /users/me`, and log out. Other authenticated routes return 403 `password_change_required`: `You must change your password before continuing.` Reusing the temporary password fails with `Choose a different password.` Changing the password or completing a reset clears the flag.

Both return:

```json
{
  "accessToken": "",
  "refreshToken": "",
  "expiresAt": "2026-10-15T20:00:00.000Z",
  "user": {}
}
```

`expiresAt` is when the access token expires. `user` is the user object below.

`POST /auth/refresh` (200) body `{ "refreshToken": "" }` returns a new pair. The first use rotates the token. Another use within 2 minutes also returns a new pair. After that, or after logout or a password change, reuse returns 401.

`POST /auth/logout` (200) requires auth. Body `{ "refreshToken": "" }`. Returns `{ "ok": true }`.

`GET /auth/user/forgot-password?email=` stores a code, emails it with Resend, and always returns `{ "ok": true }` when `email` is present. Another request for the same user within 60 seconds does not send a second mail. Codes expire in 15 minutes. `RESEND_API_KEY`, `EMAIL_FROM`, and optional `RESEND_API_URL` configure mail. Mail failures return 502 `email_failed`: `Email is not configured.` when the key or sender is missing, and `The email could not be sent.` when Resend rejects the request or cannot be reached.

`POST /auth/user/forgot-password` body `{ "email": "", "code": "", "password": "" }` sets the password, consumes the code, clears `mustChangePassword`, revokes refresh tokens, and returns `{ "ok": true }`.

## User

```json
{
  "id": "",
  "username": "",
  "email": "",
  "isSuperAdmin": false,
  "mustChangePassword": false,
  "createdAt": "",
  "updatedAt": "",
  "profile": {
    "id": "",
    "firstName": "",
    "lastName": "",
    "displayName": null,
    "timezone": "UTC",
    "phone": null,
    "zipCode": null,
    "notes": null,
    "memberNumber": null,
    "avatarUrl": null,
    "description": null
  }
}
```

- `GET /users/me` and `PATCH /users/me`
- `GET /users` is SuperAdmin only, sorted by `username`
- `GET /users/{id}` is the user, a SuperAdmin, or someone who shares an organization. Sharing means the caller has an active membership in an organization the user belongs to. `phone`, `zipCode`, and `notes` are null unless the caller is the user, a SuperAdmin, or an admin of a shared organization.
- `PATCH /users/{id}` is the user or a SuperAdmin
- `DELETE /users/{id}` is the user or a SuperAdmin, and fails with 409 while time entries or projects still reference them

Patch fields: `username`, `email`, `password`, `currentPassword`, `firstName`, `lastName`, `displayName` (up to 100 characters), `timezone`, `phone` (up to 40), `zipCode` (up to 20), `notes` (up to 2000), `avatarUrl` (up to 2000), and `description` (Markdown, up to 8000). `password` requires a non-empty `currentPassword`, or the request fails with `currentPassword is required to change the password.`. A wrong `currentPassword` fails with `The current password is incorrect.`. While `mustChangePassword` is true, `PATCH /users/me` must include a new password; other profile-only patches return 403 `password_change_required`. The update and the refresh-token revocation for a password change are saved together and clear `mustChangePassword`. Null or blank clears `displayName`, `phone`, `zipCode`, `notes`, `avatarUrl`, and `description`. `PATCH /users/me` rejects `isSuperAdmin`. `PATCH /users/{id}` accepts `isSuperAdmin` only from a SuperAdmin. The last SuperAdmin cannot be removed.

Usernames are stored lowercase, 3 to 50 characters, matching `[a-z0-9][a-z0-9._-]*`. Emails are stored lowercase. Passwords are 8 to 200 characters and are bcrypt hashes.

## Roles, organizations, departments, tags

`GET /roles` returns `{ "id", "code", "name" }` for `ADMIN`, `MEMBER`, and `VOLUNTEER`. Roles have no write routes.

Any authenticated user can `POST /organizations` with `{ "name" }` and becomes that organization's `ADMIN`.

Organization `{ "id", "name", "volunteerHourlyRate", "rateSourceYear", "defaultRateType", "preferences", "themeId", "theme", "wordmarkUrl", "wordmarkOnLightUrl", "markUrl", "accentImageUrl", "description", "websiteUrl" }`. `description` is Markdown, up to 8000 characters. `websiteUrl` is up to 2000 characters. `volunteerHourlyRate` is the current default volunteer `HourlyRate` (`35.47` when an organization is created). `defaultRateType` is `Volunteer` or `Professional`. `preferences` is `{ "allowTimeEntryEditing": boolean, "entityLabels": { "organization", "project", "department", "taskCategory" } }`. `allowTimeEntryEditing` defaults to false. Entity label defaults are Organization, Project, Department, and Task category. Creating an organization assigns the seeded VolunTime global theme.

- `GET /organizations` lists organizations the caller belongs to. SuperAdmin lists all.
- `GET /organizations/{id}` requires membership or SuperAdmin
- `PATCH /organizations/{id}` requires an organization admin. Fields: `name`, `volunteerHourlyRate`, `rateSourceYear`, `defaultRateType`, `preferences`, `themeId`, `wordmarkUrl`, `wordmarkOnLightUrl`, `markUrl`, `accentImageUrl`, `description`, and `websiteUrl`. Null or blank clears `description` and `websiteUrl`. `volunteerHourlyRate` updates the organization's default volunteer rate. `themeId` must be a global theme or a theme owned by this organization. Marks stay on the organization.
- `GET/POST /organizations/{id}/themes` and `PATCH/DELETE /organizations/{id}/themes/{themeId}`. List requires membership. Create, edit, and delete require an organization admin and apply only to org-owned themes. Global themes are read-only; saving edits of a global theme creates a new org-owned copy in the UI. Theme body: `name`, hex colors `primary`, `primaryForeground`, `highlight`, `accent`, `success`, `surface`, `surfaceForeground`, `foreground`, and `chartColor`, fonts `headingFont` and `bodyFont` (`HelveticaNeue`, `AvenirNext`, `SourceSans3`, `NunitoSans`, or `Geist`), `categoricalPalette` (6–8 colors), `sequentialPalette` (5–10), and `divergingPalette` (7). Helvetica Neue and Avenir Next use system fonts with Source Sans 3 / Nunito Sans fallbacks. `chartColor` is the single color used by every chart. Deleting the active org theme reassigns the organization to VolunTime.
- `GET/POST /organizations/{id}/hourly-rates` and `PATCH/DELETE /hourly-rates/{id}`. Create and edit require an organization admin. List requires membership. Body `{ "type", "name", "perHourRate", "isDefault", "isArchived", "source" }`. `type` is `Volunteer` or `Professional`. `source` is optional, 1 to 200 characters, and empty when omitted or blank. A patch can set `source` to `null` to clear it. Each organization has exactly one default volunteer rate. Only a volunteer rate can be the default, and that rate cannot be archived or deleted. Archived rates stay in this list. Time entries snapshot `hourlyRateId` and `hourlyRate`; deleting a rate that is still referenced fails with 409 `Archive this rate instead. Time entries still use it.`.
- `DELETE /organizations/{id}` requires an organization admin and fails with 409 while time entries remain
- `GET/POST /organizations/{id}/task-categories` and `PATCH/DELETE /task-categories/{id}`. Create and edit require an organization admin. Body `{ "name" }`. Delete fails with 409 while time entries remain.
- `GET/POST /organizations/{id}/projects` and `GET/PATCH/DELETE /projects/{id}`. Body includes `title`, `accessType` (`Public`, `Private`, or `Department`), optional `projectType` (`Project` or `Event`, default `Project`), optional `departmentId`, `description`, `startDate`, `endDate`, `isActive`, and `editorIds`. Department projects require `departmentId`, and other projects must leave it empty. Only an organization admin or that department's admin can make a Department project. Editors must be members of the organization. See Project visibility below.
- `GET /organizations/{id}/report` requires membership. See Reports below.
- `GET /organizations/{id}/time-entries.csv` requires membership and returns the filtered Volunteer Log as CSV. See Reports below.
- `GET /organizations/{id}/summary.csv` requires membership and returns the Summary sheet as CSV. See Reports below.

### Import

`POST /organizations/{id}/imports/people`, `POST /organizations/{id}/imports/departments`, and `POST /organizations/{id}/imports/projects` require an organization admin. Body `{ "rows": [ ... ] }` with at most 1000 rows. Blank rows are ignored. A row that fails validation is listed in `errors` and the rest continue. Existing records are skipped and not updated: people by email, departments by name, and projects by title. Names and titles match case-insensitively. A repeated key later in the same file is also skipped.

Response `{ "created", "skipped", "errors": [{ "row", "message" }] }`. Row numbers start at 1 for the first submitted data row. People also return `passwords`: `{ "email", "username", "temporaryPassword" }` for accounts created by that request. New people must change that password the first time they sign in. `username` is derived from the email when it is omitted. `role` defaults to `VOLUNTEER`. `timezone` defaults to `UTC`. `primaryDepartment` and project `department` are existing department names; an unknown name is a row error and does not create a department. Project `accessType` defaults to `Public`, `projectType` to `Project`, and `isActive` to true. Department projects require `department`. Public and Private projects must leave it empty. The project owner is the caller.

People fields: `email`, `firstName`, `lastName`, `displayName`, `timezone`, `phone`, `zipCode`, `notes`, `memberNumber`, `username`, `role`, `primaryDepartment`. Department field: `name`. Project fields: `title`, `description`, `projectType`, `accessType`, `department`, `startDate`, `endDate`, `isActive`. Dates are `yyyy-MM-dd` or `M/d/yyyy`. Booleans accept `true`, `false`, `yes`, and `no`.

### Project visibility

Organization admins and SuperAdmins see every project in the organization. Other members see Public projects, projects they own or edit, and Department projects for departments they belong to. `GET /organizations/{id}/projects` returns only the projects the caller can see, sorted by `title`. `GET /projects/{id}` returns 403 for a project the caller cannot see. Projects can be changed by their owner, their editors, an organization admin, or, for a Department project, that department's admin.

Time can be logged against a Private project only when the worker owns or edits it, or the caller is an organization admin or SuperAdmin.

Department `{ "id", "organizationId", "name" }`:

- `GET/POST /organizations/{id}/departments`. Create requires an organization admin. Body `{ "name" }`.
- `GET /departments/{id}` requires organization membership
- `PATCH/DELETE /departments/{id}` requires an organization admin. Delete fails with 409 while time entries remain. Names are unique per organization, case-insensitively.

Tag `{ "id", "organizationId", "name" }`:

- `GET/POST /organizations/{id}/tags`. Create requires an organization admin. Body `{ "name" }`.
- `PATCH/DELETE /tags/{id}` requires an organization admin. Names are unique per organization, case-insensitively.

## Memberships

```json
{
  "id": "",
  "userId": "",
  "organizationId": "",
  "departmentId": null,
  "role": { "id": "", "code": "MEMBER", "name": "Member" },
  "joinedAt": "",
  "rateType": "Volunteer",
  "professionalBillingRate": null,
  "isActive": true,
  "primaryDepartmentId": null,
  "departmentIds": [],
  "orgUserTitle": null,
  "orgUserDescription": null,
  "user": { "id": "", "username": "", "email": "", "firstName": "", "lastName": "", "displayName": null }
}
```

Organization memberships leave `departmentId` null. Department memberships set both ids, and their `rateType`, `professionalBillingRate`, `isActive`, `primaryDepartmentId`, `orgUserTitle`, and `orgUserDescription` are null. `orgUserTitle` is that person's title in the organization (up to 100 characters). `orgUserDescription` is Markdown about that person in the organization (up to 8000 characters). `departmentIds` lists every department the person belongs to. A person may belong to more than one department.

Only active organization memberships grant access. An inactive member cannot read or write the organization, and their department roles in it stop counting. Their time entries are kept.

- `GET /organizations/{id}/memberships` and `GET /departments/{id}/memberships` require membership in the organization
- `POST /organizations/{id}/memberships` requires an organization admin. Body `{ "email", "username", "password", "firstName", "lastName", "displayName", "timezone", "phone", "zipCode", "notes", "avatarUrl", "description", "orgUserTitle", "orgUserDescription", "role", "departmentIds" }`. `firstName`, `lastName`, `email`, and `role` are required. A new account also needs `username` and `password`, and is created with `mustChangePassword` true. An existing email adds that person to the organization and does not change their password. `departmentIds` is optional. A duplicate membership fails with 409 `This person is already in the organization.`
- `PATCH .../memberships/{membershipId}` body may include `role`, and on an organization membership also `rateType` (`Volunteer` or `Professional`), `professionalBillingRate`, `isActive`, `primaryDepartmentId`, `departmentIds`, `email`, profile fields `firstName`, `lastName`, `displayName`, `timezone`, `phone`, `zipCode`, `notes`, `avatarUrl`, and `description`, and membership fields `orgUserTitle` and `orgUserDescription`. Null or blank clears those optional text fields. `email` is stored lowercase. A duplicate fails with 409 `That email is already in use.` Organization memberships require an organization admin. Department memberships require that department's admin or the organization admin. `primaryDepartmentId` must be a department of that organization, or null. `departmentIds` replaces the person's departments in that organization. An organization membership patch with none of these fields fails with `Provide at least one field to update.`. Time entries no longer take their rate from membership `rateType` or `professionalBillingRate`.
- `DELETE` removes the membership. The member, an organization admin, or (for a department) that department's admin may do it. Removing an organization membership also removes that user's department memberships in the organization. The account and time entries are kept. The last organization admin cannot be removed or demoted.
- `DELETE /organizations/{id}/memberships` body `{ "membershipIds": [""] }` removes those organization memberships in one request. The same rules apply: an organization admin, or the member when every id is their own. An unknown id fails the whole request with 404 and removes nobody. Removing the last organization admin fails with 409 `The last organization admin cannot be removed.` `membershipIds` is 1 to 100 ids. Duplicates count once.

## Invitations

```json
{
  "id": "",
  "email": "",
  "organizationId": "",
  "departmentId": null,
  "role": { "id": "", "code": "MEMBER", "name": "Member" },
  "invitedByUserId": "",
  "expiresAt": "",
  "acceptedAt": null,
  "revokedAt": null,
  "createdAt": ""
}
```

`POST /organizations/{id}/invitations` and `POST /departments/{id}/invitations` body `{ "email": "", "role": "MEMBER" }`. This always creates a pending invite, even when the email already has an account. The code is emailed and is not in the response. Invites expire after 7 days. One pending invite is allowed per email and target.

Organization invites require an organization admin. Department invites require that department's admin or the organization admin. `departmentId` is null on an organization invite.

`GET` lists invitations for that target. `DELETE /organizations/{id}/invitations/{invitationId}` and the department equivalent revoke a pending invite and return it. An accepted invite cannot be revoked.

`POST /invitations/accept` requires auth. Body `{ "code": "" }`. The signed-in user's email must match the invite. Signup does not accept invites. Accepting a department invite creates an organization `MEMBER` membership when the user has none, and does not change an organization role they already have. Response:

```json
{
  "invitation": {},
  "organizationMembership": {},
  "departmentMembership": null
}
```

`departmentMembership` is null for an organization invite. `organizationMembership` is present when this call created one, and null when a department invite found an existing organization membership.

## Time

User time entry:

```json
{
  "id": "",
  "userId": "",
  "enteredByUserId": "",
  "organizationId": "",
  "departmentId": null,
  "projectId": "",
  "taskCategoryId": "",
  "mode": "Punch",
  "startedAt": null,
  "endedAt": null,
  "durationMinutes": null,
  "occurredOn": "2026-10-15",
  "description": null,
  "hourlyRateId": "",
  "hourlyRate": 35.47,
  "inKindValue": null,
  "sourceRef": null,
  "createdAt": "",
  "tagIds": []
}
```

`mode` is `Punch`, `Duration`, or `Total`. `projectId` and `taskCategoryId` are required and belong to the entry's organization. A department project is only valid when `departmentId` matches that project. Tags must belong to the entry's organization. The entry's user must be an active member of the organization. `departmentId` attributes the hours and does not require a department membership. The caller may be that user, a super admin, an organization admin, or a department admin for that department. `enteredByUserId` is the caller. Optional `hourlyRateId` selects an unarchived rate in that organization. A volunteer logging their own time always uses the default volunteer rate. Admins and members may choose any unarchived rate; when `hourlyRateId` is omitted, the default volunteer rate is used. The server snapshots `hourlyRateId` and `hourlyRate`, then sets `inKindValue` from the minutes. SuperAdmin bypasses membership checks and still has to satisfy the time rules.

A user has at most one open punch. Punch `occurredOn` is the user's local date of `startedAt` in their profile timezone. Closing a punch sets `endedAt`, `durationMinutes` (1–1440), and `inKindValue`. Duration entries require `occurredOn`. Send `durationMinutes` from 1 to 1440 with no times, a `startedAt` and `endedAt` (minutes are calculated), or a `startedAt` and `durationMinutes` (the end is calculated). When all three are sent, the minutes must match the times. Total entries require `occurredOn` and `durationMinutes` from 1 to 59940, with empty start and end.

- `GET/POST /users/{id}/time-entries`. Read is the user, a super admin, or someone who shares an organization. Someone who only shares an organization sees entries in the shared organizations, and gets 403 when filtering by another organization. Write is the user, a super admin, an organization admin, or a department admin for the target department. Optional filters: `organizationId`, `departmentId`, `from`, `to` (`occurredOn`, inclusive). Sorted by `occurredOn` and then `startedAt`, newest first. Optional `sourceRef` on create is a unique import key of 1 to 200 characters. A duplicate fails with 409 `That sourceRef is already in use.`.
- `GET/PATCH/DELETE /time-entries/{id}` for the owner, the person who entered it, a super admin, an organization admin, or that department's admin.
- `POST /time/clock-in` (201) body `{ "organizationId", "departmentId", "projectId", "taskCategoryId", "description", "tagIds" }`. `departmentId`, `description`, and `tagIds` are optional. `startedAt` is the current time.
- `POST /time/clock-out` (200) closes the caller's open punch. Body may include `description` and `tagIds`.
- `POST /time/duration` (201) and `POST /time/total` (201) create an entry for the caller.

`POST /users/{id}/time-entries` body includes `mode` and the same fields. An open punch omits `endedAt`. A closed punch includes `startedAt` and `endedAt`. A sent `occurredOn` on a punch must match the local date of `startedAt`. A sent `durationMinutes` on a punch must match the calculated minutes.

Patch updates `description`, `tagIds`, `organizationId`, `departmentId`, `projectId`, and `taskCategoryId`. Time fields (`startedAt`, `endedAt`, `durationMinutes`, `occurredOn`) are accepted only when the entry's organization has `preferences.allowTimeEntryEditing` set. Otherwise a punch responds `You cannot change punch times here.` and any other entry responds `Time entries cannot be edited.`. When editing is allowed, Duration and Total entries can patch `durationMinutes` and `occurredOn`. Duration entries can patch `startedAt` and `endedAt`; a new end recalculates the minutes, and new minutes recalculate the end. Punch entries can patch `startedAt`, `endedAt`, and `durationMinutes` with the same calculation, including an open punch. Rates are recalculated when the duration changes. Moving an entry to another organization, or sending `hourlyRateId`, resolves the rate again and recalculates `inKindValue`. When `tagIds` is not sent, the entry's current tags must also belong to the new organization. The destination organization's preference decides whether the time fields are allowed.

Collective time entry:

```json
{
  "id": "",
  "recordedByUserId": "",
  "organizationId": "",
  "departmentId": null,
  "startedAt": "",
  "endedAt": "",
  "projectId": "",
  "taskCategoryId": "",
  "participantCount": 1,
  "description": null,
  "hourlyRateId": "",
  "hourlyRate": 35.47,
  "inKindValue": 0,
  "tagIds": []
}
```

`endedAt` is after `startedAt`. `participantCount` is at least 1. An organization admin may record one for the organization or any of its departments. A department admin may record one only for that department. Members of the organization may read them.

- `GET/POST /collective-time-entries`. Filters: `organizationId`, `departmentId`. Create body is the fields above except `id` and `recordedByUserId` (the caller).
- `GET/PATCH/DELETE /collective-time-entries/{id}`. Patch uses the same fields as create. `organizationId` cannot change.

## Reports

`GET /organizations/{id}/report`, `GET /organizations/{id}/time-entries.csv`, and `GET /organizations/{id}/summary.csv` take the same optional query: `departmentId`, `taskCategoryId`, `projectId`, `userId`, `from`, and `to`. User entries are filtered by `occurredOn`. Collective entries are filtered by the UTC date of `startedAt` and ignore `userId`. Organization admins see the whole organization. Department admins (group coordinators) are scoped to the union of departments they admin; asking for another `departmentId` returns 403. Volunteers stay self-only. `user` is volunteer-rate hours. `staff` is the same rollup for professional-rate hours and stays out of volunteer KPIs. Collective entries with a professional rate are omitted from `collective`.

```json
{
  "user": {
    "hours": 0,
    "volunteers": 0,
    "entries": 0,
    "inKind": 0,
    "byDepartment": [],
    "byCategory": [],
    "byPerson": [],
    "byVolunteer": [],
    "byProject": [],
    "byMonth": []
  },
  "staff": {
    "hours": 0,
    "volunteers": 0,
    "entries": 0,
    "inKind": 0,
    "byDepartment": [],
    "byCategory": [],
    "byPerson": [],
    "byVolunteer": [],
    "byProject": [],
    "byMonth": []
  },
  "collective": {
    "hours": 0,
    "entries": 0,
    "inKind": 0,
    "byDepartment": [],
    "byCategory": [],
    "byProject": []
  }
}
```

Each group item is `{ "id", "label", "hours", "volunteers", "entries", "inKind" }`. `hours` is total minutes divided by 60, rounded to 5 decimals. `inKind` is rounded to 2 decimals. `volunteers` counts distinct users with a non-empty person label and is always 0 for collective groups and month buckets. Hours without a department use id `organization` and the organization name. `byVolunteer` uses the same people as `byPerson` but excludes hours from the task category named `Participant Hours` while still including all in-kind. `byMonth` is calendar months of `occurredOn`, labeled with the English month name and sorted by year then month. A person's label is their display name, then `firstName lastName`, then their username; empty first and last names stay blank and do not count as unique volunteers. A collective entry counts the minutes between `startedAt` and `endedAt`, rounded to the nearest minute with 30 seconds rounding up. Groups other than `byMonth` are sorted by `hours` descending, then `label`, then `id`, comparing strings by UTF-16 code unit.

The Volunteer Log CSV has content type `text/csv; charset=utf-8`, UTF-8 without a byte order mark. Lines end with `\n`, and there is no newline after the last row. Column names use the organization's entity labels. The first line is:

```text
Date,{project},Volunteer,{department} / {organization},{taskCategory},Entry Method,Start Time,End Time,Manual Duration,Hours,Rate Type,Hourly Rate,In-Kind Value,Tags,Entered By,Date Entered,Hour Attribution,Notes,Volunteer ID
```

Rows are user entries sorted by `occurredOn` and then `createdAt`. Cell formats match Excel display:

- Date and Date Entered are `M/D/YYYY` in UTC.
- `{department} / {organization}` is the department name, or the organization name when there is no department.
- Entry Method is `Total Hours`, `Start / End Time`, or `Duration`.
- Start Time and End Time are `h:mm AM/PM` in UTC, or empty.
- Manual Duration is `H:MM` from `durationMinutes`, or empty.
- Hours has up to 5 decimals with no trailing zeros, and is empty for an open punch.
- Rate Type is the `HourlyRate.name`, or empty.
- Hourly Rate and In-Kind Value have exactly 2 decimals. Hourly Rate is empty when the snapshot is `0`. In-Kind Value is empty when unset.
- Tags are names sorted by UTF-16 code unit and joined with `, `.
- Volunteer and Entered By use the person label above.
- Hour Attribution is empty.
- Notes is the description, or empty.
- Volunteer ID is `UserProfile.memberNumber`, or empty.

`GET /organizations/{id}/summary.csv` stacks a KPI block (`Total Volunteer Hours`, `Total In-Kind Value`, `Unique Volunteers`, `Total Entries`) and five tables (organization/department buckets, task category, month, volunteer, project) using the same numbers as the report. Volunteer table hours use `byVolunteer`.

A cell that starts with `=`, `+`, `-`, `@`, a tab, or a carriage return gets a leading `'`. A cell containing `"`, `,`, a newline, or a carriage return is wrapped in double quotes, with each `"` doubled.

## Organization API keys

ClockedIn.Api accepts organization API keys on REST and on `POST /mcp`. The Next.js app accepts the same keys on `POST /mcp`. Next.js REST routes still require a user JWT unless `CSHARP_API_URL` is set and Next proxies to ClockedIn.Api. A key is shown once at create or rotate: `cki_live_<prefix>_<secret>` in production, `cki_test_…` otherwise. Send `Authorization: Bearer <key>` or `X-Api-Key: <key>`. Only the HMAC hash is stored. Key create, list, rotate, and revoke require a human organization admin JWT. A key cannot mint other keys.

Scopes:

- `org:read` — get and list the organization and its catalogs, members, projects, time, reports
- `org:write` — time, projects, tags, task categories, departments, collective time
- `org:admin` — memberships, invitations, rates, themes, organization settings. Not organization delete.

`GET/POST /organizations/{id}/api-keys`. Body `{ "name", "scopes", "expiresAt" }`. `name` is 1 to 80 characters. `scopes` is a non-empty array of the values above. `expiresAt` is optional. Create returns the plaintext `key` once. List omits `key`.

`PATCH /organizations/{id}/api-keys/{keyId}` updates `name`, `scopes`, or `expiresAt`. `POST .../rotate` issues a new secret and prefix. `DELETE` revokes. Clock-in and clock-out with a key require `userId`.

## Platform API keys

ClockedIn.Api also issues platform keys. Only a SuperAdmin JWT can create, list, rotate, or revoke them. A platform key is not a SuperAdmin user: it can read and administer every organization, but it cannot mint keys, create or delete organizations, list users, or moderate feedback.

Scope:

- `platform:admin` — any organization, with the same write and admin abilities as `org:admin`

`GET/POST /platform/api-keys`. Body `{ "name", "scopes", "expiresAt" }`. `scopes` must be `["platform:admin"]`. Create returns the plaintext `key` once. List omits `key`.

`PATCH /platform/api-keys/{keyId}` updates `name`, `scopes`, or `expiresAt`. `POST .../rotate` issues a new secret and prefix. `DELETE` revokes.

MCP is Streamable HTTP at `/mcp` on ClockedIn.Api and on the Next.js app. Clients send the same Bearer key. Tools wrap the same feature services as REST, with the same names and arguments on both hosts. Auth, signup, password reset, SuperAdmin user list, feedback moderation, and deleting an organization are not exposed.

```json
{
  "mcpServers": {
    "clocked-in": {
      "url": "https://<next-host>/mcp",
      "headers": { "Authorization": "Bearer cki_live_…" }
    }
  }
}
```

## Authorization summary

SuperAdmin is a user flag, not a membership role. A SuperAdmin can read and write every entity. The first SuperAdmin is set in SQL: `UPDATE "User" SET "isSuperAdmin" = true WHERE "email" = '...'`.

After organization creation, organization admins manage the organization, its theme, departments, projects, task categories, tags, rates, invitations, membership roles, and collective time for the organization or any department. They may also enter user time for a member. Department admins manage that department's invitations, membership roles, collective time, and user time for that department. Members read the organization and manage only their own user time against a target they belong to. User totals and collective totals stay separate in reports.
