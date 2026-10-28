export function welcomeTitle(name: string) {
  const first = name.trim().split(/\s+/)[0];
  return first ? `Welcome back, ${first}` : "Welcome back";
}

export function viewTitle(pathname: string | null, name: string, organizationName?: string | null) {
  if (!pathname) return "";
  if (pathname === "/") return organizationName?.trim() || "Home";
  if (pathname === "/dashboard/design") return "Edit dashboard";
  if (pathname.startsWith("/dashboard")) return welcomeTitle(name);
  if (pathname.startsWith("/log")) return "Log time";
  if (pathname.startsWith("/entries")) return "Entries";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname === "/organization/new") return "New organization";
  if (pathname === "/organization") return organizationName?.trim() || "Organization";
  if (pathname.startsWith("/profile")) return "Profile";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/developer")) return "Developer";
  if (pathname.startsWith("/about-prototype")) return "Guide";
  if (pathname.startsWith("/feedback")) return "Feedback";
  if (pathname.startsWith("/needs")) return "Needs";
  return "";
}
