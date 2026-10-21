export type ImportField = {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
  matchesSample?: (samples: string[]) => boolean;
};

function majority(samples: string[], test: (value: string) => boolean) {
  const values = samples.map((sample) => sample.trim()).filter(Boolean);
  if (values.length === 0) {
    return false;
  }

  const hits = values.filter(test).length;
  return hits * 2 > values.length;
}

function emailSample(samples: string[]) {
  return majority(samples, (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function phoneSample(samples: string[]) {
  return majority(samples, (value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15 && /^[+\d\s().-]+$/.test(value);
  });
}

function zipSample(samples: string[]) {
  return majority(samples, (value) => /^\d{5}(?:-\d{4})?$/.test(value) || /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(value));
}

function memberNumberSample(samples: string[]) {
  return majority(samples, (value) => /^\d{1,6}$/.test(value));
}

function dateSample(samples: string[]) {
  return majority(samples, (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value));
}

function boolSample(samples: string[]) {
  return majority(samples, (value) => /^(yes|no|true|false|y|n|1|0)$/i.test(value));
}

function roleSample(samples: string[]) {
  return majority(samples, (value) => /^(member|volunteer|admin)$/i.test(value));
}

function timezoneSample(samples: string[]) {
  return majority(samples, (value) => /^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/.test(value));
}

function projectTypeSample(samples: string[]) {
  return majority(samples, (value) => /^(project|event)$/i.test(value));
}

function accessTypeSample(samples: string[]) {
  return majority(samples, (value) => /^(public|private|department)$/i.test(value));
}

export type ImportEntity = "people" | "departments" | "projects";

export function peopleFields(departmentLabel = "Department"): ImportField[] {
  const department = departmentLabel.toLowerCase();
  return [
    { key: "email", label: "Email", required: true, aliases: ["email", "e-mail", "email address"], matchesSample: emailSample },
    { key: "username", label: "Username", required: false, aliases: ["username", "user name", "login"] },
    { key: "firstName", label: "First name", required: true, aliases: ["first name", "firstname", "given name"] },
    { key: "lastName", label: "Last name", required: true, aliases: ["last name", "lastname", "surname", "family name"] },
    { key: "displayName", label: "Display name", required: false, aliases: ["display name"] },
    { key: "timezone", label: "Timezone", required: false, aliases: ["timezone", "time zone", "tz"], matchesSample: timezoneSample },
    { key: "phone", label: "Phone", required: false, aliases: ["phone", "phone number", "mobile", "mobile phone"], matchesSample: phoneSample },
    { key: "zipCode", label: "ZIP code", required: false, aliases: ["zip", "zip code", "postal code", "postal"], matchesSample: zipSample },
    { key: "notes", label: "Notes", required: false, aliases: ["notes", "note", "comments"] },
    {
      key: "memberNumber",
      label: "Member number",
      required: false,
      aliases: ["member number", "volunteer id", "volunteer number"],
      matchesSample: memberNumberSample,
    },
    { key: "role", label: "Role", required: false, aliases: ["role"], matchesSample: roleSample },
    {
      key: "primaryDepartment",
      label: `Primary ${department}`,
      required: false,
      aliases: ["primary group", "primary department", "group", "department", department],
    },
  ];
}

export function departmentFields(departmentLabel = "Department"): ImportField[] {
  return [
    {
      key: "name",
      label: "Name",
      required: true,
      aliases: ["name", "group", "department", "title", departmentLabel.toLowerCase()],
    },
  ];
}

export function projectFields(departmentLabel = "Department"): ImportField[] {
  return [
    { key: "title", label: "Title", required: true, aliases: ["title", "name", "project", "project name"] },
    { key: "description", label: "Description", required: false, aliases: ["description", "details"] },
    { key: "projectType", label: "Type", required: false, aliases: ["type", "project type"], matchesSample: projectTypeSample },
    {
      key: "accessType",
      label: "Access",
      required: false,
      aliases: ["access", "access type", "visibility"],
      matchesSample: accessTypeSample,
    },
    {
      key: "department",
      label: departmentLabel,
      required: false,
      aliases: ["group", "department", departmentLabel.toLowerCase()],
    },
    { key: "startDate", label: "Start date", required: false, aliases: ["start", "start date"], matchesSample: dateSample },
    { key: "endDate", label: "End date", required: false, aliases: ["end", "end date"], matchesSample: dateSample },
    { key: "isActive", label: "Active", required: false, aliases: ["active", "is active"], matchesSample: boolSample },
  ];
}

export function fieldsFor(entity: ImportEntity, departmentLabel = "Department") {
  if (entity === "people") {
    return peopleFields(departmentLabel);
  }

  if (entity === "departments") {
    return departmentFields(departmentLabel);
  }

  return projectFields(departmentLabel);
}
