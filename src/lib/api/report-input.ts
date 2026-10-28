import { validation } from "@/lib/api/errors";
import { normalizeFilters, normalizeLayout, normalizeReportName } from "@/lib/report-layout";

/** Report layout, name, and filters from a request body, as 400s instead of thrown errors. */
export function readLayout(value: unknown) {
  try {
    return normalizeLayout(value);
  } catch (error) {
    validation(error instanceof Error ? error.message : "layout is invalid.");
  }
}

export function readFilters(value: unknown) {
  try {
    return normalizeFilters(value);
  } catch (error) {
    validation(error instanceof Error ? error.message : "filters are invalid.");
  }
}

export function readName(value: unknown) {
  try {
    return normalizeReportName(value);
  } catch (error) {
    validation(error instanceof Error ? error.message : "name is required.");
  }
}
