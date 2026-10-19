export function welcomeTitle(name: string) {
  const first = name.trim().split(/\s+/)[0];
  return first ? `Welcome back, ${first}` : "Welcome back";
}

export function viewTitle(pathname: string, name: string) {
  if (pathname.startsWith("/dashboard")) return welcomeTitle(name);
  if (pathname.startsWith("/log")) return "Log time";
  if (pathname.startsWith("/entries")) return "Entries";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/profile")) return "Profile";
  if (pathname.startsWith("/settings")) return "Settings";
  return "";
}
