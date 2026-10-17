import path from "node:path";
import ExcelJS from "exceljs";

export const clockedInThemeId = "44444444-4444-4444-8444-444444444441";
export const orgName = "CASWJ";
export const baseCaswjThemeName = "Base CASWJ";

function themePalette(colors: string[]) {
  return JSON.stringify(colors.map((color) => color.toUpperCase()));
}

/** Org-owned CASWJ theme from the brand guidelines and wjarts.org. */
export const baseCaswjTheme = {
  name: baseCaswjThemeName,
  primary: "#001836",
  primaryForeground: "#FFFFFF",
  highlight: "#D4AC59",
  accent: "#FF5E9F",
  success: "#4EBFAE",
  surface: "#FFFFFF",
  surfaceForeground: "#001836",
  foreground: "#001836",
  headingFont: "HelveticaNeue",
  bodyFont: "AvenirNext",
  categoricalPalette: themePalette(["#001836", "#D4AC59", "#4EBFAE", "#FF5E9F", "#738091", "#EAD6AC"]),
  sequentialPalette: themePalette(["#E8EEF4", "#9AADC2", "#4A6580", "#001836", "#000D1A"]),
  divergingPalette: themePalette(["#FF5E9F", "#FF9EC4", "#FFD6E6", "#FFFFFF", "#B8E8DE", "#4EBFAE", "#001836"]),
};

export const workbookPath = path.resolve(process.cwd(), "docs/base/Volunteer Hours.xlsx");
export const caswjSourceRefPrefix = "caswj-log:";
export const departmentNames = [
  "Literary Arts Society",
  "Sugar Factory Playhouse",
  "Visual Arts Society",
  "West Jordan Community Band",
  "West Jordan Jazz Band",
  "West Jordan Symphony",
  "West Jordan Winds",
  "West Jordan Youth Theatre",
];
export const caswjLabels = {
  organization: "Organization",
  project: "Project / Event",
  department: "Group",
  taskCategory: "Task Category",
};

export type CaswjPerson = {
  firstName: string;
  lastName: string;
  displayName: string;
  memberNumber: string;
  active: boolean;
};

export type CaswjLogRow = {
  sheetRow: number;
  occurredOn: Date;
  project: string;
  volunteer: string;
  group: string;
  category: string;
  startedAt: Date | null;
  endedAt: Date | null;
  hours: number;
  rateType: string;
  hourlyRate: number;
  inKind: number;
  tags: string[];
  enteredBy: string;
  createdAt: Date;
  notes: string;
  volunteerId: string;
};

export type CaswjWorkbook = {
  categories: Set<string>;
  projectTitles: Set<string>;
  people: Map<string, CaswjPerson>;
  logRows: CaswjLogRow[];
};

export type ReportGroup = {
  id: string;
  label: string;
  hours: number;
  volunteers: number;
  entries: number;
  inKind: number;
};

export type ExpectedCaswjReport = {
  hours: number;
  volunteers: number;
  entries: number;
  inKind: number;
  byDepartment: ReportGroup[];
  byCategory: ReportGroup[];
  byPerson: ReportGroup[];
  byVolunteer: ReportGroup[];
  byProject: ReportGroup[];
  byMonth: ReportGroup[];
};

export function cell(value: ExcelJS.CellValue): unknown {
  if (value == null) {
    return null;
  }

  if (typeof value === "object" && "result" in value) {
    return cell(value.result as ExcelJS.CellValue);
  }

  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }

  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("");
  }

  return value;
}

export function text(value: unknown) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

export function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
}

export function localEmail(username: string) {
  return `${username}+caswj@clocked-in.local`;
}

export function onDate(occurredOn: Date, clock: Date | null) {
  if (!clock) {
    return null;
  }

  return new Date(
    Date.UTC(occurredOn.getUTCFullYear(), occurredOn.getUTCMonth(), occurredOn.getUTCDate(), clock.getUTCHours(), clock.getUTCMinutes(), 0, 0),
  );
}

export function asDate(value: unknown) {
  return value instanceof Date ? value : null;
}

export function cents(value: number) {
  return Math.round(Number(`${value}e2`));
}

export function money(value: number) {
  return cents(value) / 100;
}

export function inKindFromMinutes(durationMinutes: number, hourlyRate: number) {
  return Math.round((durationMinutes * cents(hourlyRate)) / 60) / 100;
}

export function hoursFromMinutes(minutes: number) {
  return Math.round((minutes * 100000) / 60) / 100000;
}

export function hoursCell(minutes: number) {
  return String(Number(hoursFromMinutes(minutes).toFixed(5)));
}

export function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function assignMemberNumbers(people: Map<string, CaswjPerson>) {
  let nextMember = Math.max(0, ...[...people.values()].map((person) => Number(person.memberNumber) || 0));
  for (const person of people.values()) {
    if (!person.memberNumber) {
      nextMember += 1;
      person.memberNumber = String(nextMember).padStart(3, "0");
    }
  }
}

export async function loadCaswjWorkbook(filePath = workbookPath): Promise<CaswjWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const lists = workbook.getWorksheet("Lists & Settings");
  const volunteersSheet = workbook.getWorksheet("Volunteers");
  const log = workbook.getWorksheet("Volunteer Log");
  if (!lists || !volunteersSheet || !log) {
    throw new Error("Volunteer Hours.xlsx is missing Lists & Settings, Volunteers, or Volunteer Log.");
  }

  const categories = new Set<string>();
  const projectTitles = new Set<string>(["General / No Specific Project"]);
  lists.eachRow((row, number) => {
    if (number >= 2 && number <= 5) {
      const category = text(cell(row.getCell(7).value));
      if (category) {
        categories.add(category);
      }
    }

    if (number >= 21) {
      const title = text(cell(row.getCell(1).value));
      if (title && title !== "Project / Event") {
        projectTitles.add(title);
      }
    }
  });

  const people = new Map<string, CaswjPerson>();
  volunteersSheet.eachRow((row, number) => {
    if (number === 1) {
      return;
    }

    const firstName = text(cell(row.getCell(2).value));
    const lastName = text(cell(row.getCell(3).value));
    if (!firstName && !lastName) {
      return;
    }

    const displayName = text(cell(row.getCell(4).value)) || `${firstName} ${lastName}`.trim();
    const memberNumber = text(cell(row.getCell(1).value)).padStart(3, "0");
    people.set(displayName.toLowerCase(), {
      firstName,
      lastName,
      displayName,
      memberNumber,
      active: text(cell(row.getCell(8).value)).toLowerCase() !== "no",
    });
  });

  const logRows: CaswjLogRow[] = [];
  log.eachRow((row, number) => {
    if (number === 1) {
      return;
    }

    const occurredOn = asDate(cell(row.getCell(1).value));
    if (!occurredOn) {
      return;
    }

    const volunteer = text(cell(row.getCell(3).value));
    const project = text(cell(row.getCell(2).value)) || "General / No Specific Project";
    const category = text(cell(row.getCell(5).value));
    const hours = asNumber(cell(row.getCell(10).value));
    if (!category || hours == null) {
      return;
    }

    projectTitles.add(project);
    categories.add(category);
    if (volunteer && !people.has(volunteer.toLowerCase())) {
      people.set(volunteer.toLowerCase(), {
        firstName: volunteer.split(/\s+/)[0] ?? volunteer,
        lastName: volunteer.split(/\s+/).slice(1).join(" "),
        displayName: volunteer,
        memberNumber: "",
        active: true,
      });
    }

    logRows.push({
      sheetRow: number,
      occurredOn,
      project,
      volunteer,
      group: text(cell(row.getCell(4).value)),
      category,
      startedAt: asDate(cell(row.getCell(7).value)),
      endedAt: asDate(cell(row.getCell(8).value)),
      hours,
      rateType: text(cell(row.getCell(11).value)),
      hourlyRate: asNumber(cell(row.getCell(12).value)) ?? 0,
      inKind: asNumber(cell(row.getCell(13).value)) ?? 0,
      tags: text(cell(row.getCell(14).value))
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      enteredBy: text(cell(row.getCell(15).value)),
      createdAt: asDate(cell(row.getCell(16).value)) ?? occurredOn,
      notes: text(cell(row.getCell(18).value)),
      volunteerId: text(cell(row.getCell(19).value)),
    });
  });

  if (![...people.values()].some((person) => person.displayName.toLowerCase() === "clockify import")) {
    people.set("clockify import", {
      firstName: "Clockify",
      lastName: "Import",
      displayName: "Clockify Import",
      memberNumber: "",
      active: false,
    });
  }

  assignMemberNumbers(people);
  return { categories, projectTitles, people, logRows };
}

function ordinal(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function departmentOf(group: string) {
  const key = group.trim().toLowerCase();
  if (!key || key === "caswj") {
    return { id: "organization", label: orgName };
  }

  const name = departmentNames.find((department) => department.toLowerCase() === key);
  return name ? { id: name.toLowerCase(), label: name } : { id: "organization", label: orgName };
}

function personOf(people: Map<string, CaswjPerson>, volunteer: string) {
  if (!volunteer) {
    return { id: "unnamed", label: "" };
  }

  const person = people.get(volunteer.toLowerCase());
  const label = person?.displayName ?? volunteer;
  return { id: label.toLowerCase(), label };
}

function sorted(rows: ReportGroup[]) {
  return [...rows].sort((a, b) => b.hours - a.hours || ordinal(a.label, b.label) || ordinal(a.id, b.id));
}

export function expectedCaswjReport(data: CaswjWorkbook): ExpectedCaswjReport {
  type Bucket = { id: string; label: string; minutes: number; inKindCents: number; entries: number; users: Set<string> };
  const buckets = {
    department: new Map<string, Bucket>(),
    category: new Map<string, Bucket>(),
    person: new Map<string, Bucket>(),
    project: new Map<string, Bucket>(),
    month: new Map<string, Bucket>(),
  };
  const volunteerMinutes = new Map<string, number>();

  function add(map: Map<string, Bucket>, id: string, label: string, minutes: number, inKindCents: number, userId: string) {
    const current = map.get(id) ?? { id, label, minutes: 0, inKindCents: 0, entries: 0, users: new Set<string>() };
    current.minutes += minutes;
    current.inKindCents += inKindCents;
    current.entries += 1;
    current.users.add(userId);
    map.set(id, current);
  }

  for (const row of data.logRows) {
    const minutes = Math.round(row.hours * 60);
    const inKindCents = cents(inKindFromMinutes(minutes, money(row.hourlyRate)));
    const department = departmentOf(row.group);
    const person = personOf(data.people, row.volunteer);
    add(buckets.department, department.id, department.label, minutes, inKindCents, person.id);
    add(buckets.category, row.category.toLowerCase(), row.category, minutes, inKindCents, person.id);
    add(buckets.project, row.project.toLowerCase(), row.project, minutes, inKindCents, person.id);
    add(buckets.person, person.id, person.label, minutes, inKindCents, person.id);
    if (person.label && row.category.toLowerCase() !== "participant hours") {
      volunteerMinutes.set(person.id, (volunteerMinutes.get(person.id) ?? 0) + minutes);
    }

    const monthId = `${row.occurredOn.getUTCFullYear()}-${String(row.occurredOn.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthLabel = row.occurredOn.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    add(buckets.month, monthId, monthLabel, minutes, inKindCents, person.id);
  }

  function groups(map: Map<string, Bucket>): ReportGroup[] {
    return [...map.values()].map((row) => ({
      id: row.id,
      label: row.label,
      hours: hoursFromMinutes(row.minutes),
      volunteers: row.users.size,
      entries: row.entries,
      inKind: row.inKindCents / 100,
    }));
  }

  const people = sorted(groups(buckets.person).filter((row) => row.label.trim().length > 0));
  const personBuckets = [...buckets.person.values()];

  return {
    hours: hoursFromMinutes(personBuckets.reduce((sum, row) => sum + row.minutes, 0)),
    volunteers: people.length,
    entries: data.logRows.length,
    inKind: personBuckets.reduce((sum, row) => sum + row.inKindCents, 0) / 100,
    byDepartment: sorted(groups(buckets.department)),
    byCategory: sorted(groups(buckets.category)),
    byPerson: people,
    byVolunteer: sorted(
      people.map((row) => ({
        ...row,
        hours: hoursFromMinutes(volunteerMinutes.get(row.id) ?? 0),
      })),
    ),
    byProject: sorted(groups(buckets.project)),
    byMonth: [...buckets.month.values()]
      .sort((a, b) => ordinal(a.id, b.id))
      .map((row) => ({
        id: row.id,
        label: row.label,
        hours: hoursFromMinutes(row.minutes),
        volunteers: 0,
        entries: row.entries,
        inKind: row.inKindCents / 100,
      })),
  };
}
