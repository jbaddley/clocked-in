export type ReviewMember = { email: string; firstName: string | null; lastName: string | null };

export function peopleRowMatch(
  row: { firstName?: string; lastName?: string; email?: string },
  members: ReviewMember[],
) {
  const email = (row.email ?? "").trim().toLowerCase();
  const firstName = (row.firstName ?? "").trim().toLowerCase();
  const lastName = (row.lastName ?? "").trim().toLowerCase();
  if (email && members.some((member) => member.email === email)) {
    return "Existing email" as const;
  }
  if (
    firstName &&
    lastName &&
    members.some(
      (member) =>
        member.email !== email &&
        member.firstName?.toLowerCase() === firstName &&
        member.lastName?.toLowerCase() === lastName,
    )
  ) {
    return "Near match" as const;
  }
  return "New" as const;
}
