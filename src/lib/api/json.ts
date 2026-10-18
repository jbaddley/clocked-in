import { validation } from "@/lib/api/errors";
import { parseGuid } from "@/lib/api/guid";

export type Body = Record<string, unknown>;

export function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export async function readBody(request: Request): Promise<Body> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    validation("Request body must be JSON.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    validation("Request body must be JSON.");
  }

  return parsed as Body;
}

export function query(request: Request) {
  return new URL(request.url).searchParams;
}

function queryValue(params: URLSearchParams, key: string) {
  const value = params.get(key);
  return value === null || value === "" ? undefined : value;
}

function queryInt(params: URLSearchParams, key: string, fallback: number, message: string) {
  const value = queryValue(params, key);
  if (value === undefined) {
    return fallback;
  }

  if (!/^\s*[+-]?\d+\s*$/.test(value)) {
    validation(message);
  }

  return Number(value);
}

export type Page = { limit: number; offset: number };

export function page(params: URLSearchParams): Page {
  const limit = queryInt(params, "limit", 50, "limit must be from 1 to 100.");
  const offset = queryInt(params, "offset", 0, "offset must be zero or greater.");
  if (limit < 1 || limit > 100) {
    validation("limit must be from 1 to 100.");
  }

  if (offset < 0) {
    validation("offset must be zero or greater.");
  }

  return { limit, offset };
}

export function list<T>(items: T[], { limit, offset }: Page) {
  return { items, limit, offset };
}

export function queryUuid(params: URLSearchParams, key: string) {
  const value = queryValue(params, key);
  if (value === undefined) {
    return undefined;
  }

  return parseGuid(value) ?? validation(`${key} must be an id.`);
}

export function queryDate(params: URLSearchParams, key: string) {
  const value = queryValue(params, key);
  return value === undefined ? undefined : dateOnly(value, key);
}

export function has(body: Body, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export type Optional<T> = { set: false } | { set: true; value: T };

export function optional<T>(body: Body, key: string, read: (body: Body, key: string) => T): Optional<T> {
  return has(body, key) ? { set: true, value: read(body, key) } : { set: false };
}

export function or<T>(field: Optional<T>, fallback: T) {
  return field.set ? field.value : fallback;
}

export function optionalString(body: Body, key: string) {
  if (!has(body, key)) {
    return undefined;
  }

  const value = body[key];
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    validation(`${key} must be a string.`);
  }

  return value;
}

export function requireString(body: Body, key: string) {
  const value = optionalString(body, key);
  if (typeof value !== "string" || value.length === 0) {
    validation(`${key} is required.`);
  }

  return value;
}

export function requireUuid(body: Body, key: string) {
  return parseGuid(requireString(body, key)) ?? validation(`${key} must be an id.`);
}

export function optionalUuid(body: Body, key: string) {
  if (!has(body, key) || body[key] === null || body[key] === undefined) {
    return null;
  }

  return requireUuid(body, key);
}

export function requireInt(body: Body, key: string) {
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value) || Math.abs(value) > 2147483647) {
    validation(`${key} must be an integer.`);
  }

  return value;
}

export function requireBool(body: Body, key: string) {
  const value = body[key];
  if (typeof value !== "boolean") {
    validation(`${key} must be a boolean.`);
  }

  return value;
}

export function ids(body: Body, key: string, optionalField: boolean) {
  if (!has(body, key)) {
    if (optionalField) {
      return [];
    }

    validation(`${key} must be an array of ids.`);
  }

  const value = body[key];
  if (!Array.isArray(value)) {
    validation(`${key} must be an array of ids.`);
  }

  return value.map((item) => (typeof item === "string" ? parseGuid(item) : null) ?? validation(`${key} must be an array of ids.`));
}

function instant(text: string, key: string) {
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    validation(`${key} must be a date-time.`);
  }

  return new Date(Math.floor(parsed.getTime() / 1000) * 1000);
}

export function requireInstant(body: Body, key: string) {
  if (!has(body, key)) {
    validation(`${key} is required.`);
  }

  return instant(requireString(body, key), key);
}

export function optionalInstant(body: Body, key: string) {
  if (!has(body, key) || body[key] === null) {
    return null;
  }

  return instant(requireString(body, key), key);
}

export function dateOnly(value: unknown, key: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    validation(`${key} must be a date.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    validation(`${key} must be a date.`);
  }

  return parsed;
}

export function requireDate(body: Body, key: string) {
  return dateOnly(requireString(body, key), key);
}

export function optionalDate(body: Body, key: string) {
  if (!has(body, key) || body[key] === null) {
    return null;
  }

  return requireDate(body, key);
}

export function asDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function utcNow() {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

export function wholeMinutes(startedAt: Date, endedAt: Date) {
  return Math.floor((endedAt.getTime() - startedAt.getTime()) / 60000);
}

export function localDate(instantValue: Date, timeZone: string) {
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instantValue);
  } catch {
    validation("timezone must be an IANA name.");
  }

  return dateOnly(formatted, "occurredOn");
}

export function assertTimezone(timeZone: string) {
  localDate(new Date(), timeZone);
}

export function cleanOptional(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function limited(body: Body, key: string, maxLength: number, message: string) {
  const value = cleanOptional(optionalString(body, key));
  if (value !== null && value.length > maxLength) {
    validation(message);
  }

  return value;
}

export function requireName(value: string, key = "name") {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 200) {
    validation(`${key} is required.`);
  }

  return trimmed;
}

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    validation("email must be an email address.");
  }

  return email;
}

export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username)) {
    validation("username must be 3 to 50 characters and use lowercase letters, numbers, dots, underscores, or hyphens.");
  }

  return username;
}

export function normalizePassword(value: string) {
  if (value.length < 8 || value.length > 200) {
    validation("password must be 8 to 200 characters.");
  }

  return value;
}

export type RoleCode = "MEMBER" | "VOLUNTEER" | "ADMIN";
export type RateType = "Volunteer" | "Professional";
export type AccessType = "Public" | "Private" | "Department";
export type ProjectType = "Project" | "Event";

export function normalizeRole(value: string): RoleCode {
  const role = value.trim().toUpperCase();
  if (role !== "MEMBER" && role !== "VOLUNTEER" && role !== "ADMIN") {
    validation("role must be MEMBER, VOLUNTEER, or ADMIN.");
  }

  return role;
}

export function normalizeRateType(value: string): RateType {
  const rateType = value.trim();
  if (rateType !== "Volunteer" && rateType !== "Professional") {
    validation("rateType must be Volunteer or Professional.");
  }

  return rateType;
}

export function normalizeProjectType(value: string): ProjectType {
  const projectType = value.trim();
  if (projectType !== "Project" && projectType !== "Event") {
    validation("projectType must be Project or Event.");
  }

  return projectType;
}

export function normalizeAccessType(value: string): AccessType {
  const accessType = value.trim();
  if (accessType !== "Public" && accessType !== "Private" && accessType !== "Department") {
    validation("accessType must be Public, Private, or Department.");
  }

  return accessType;
}

export function personName(value: string, key: string) {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    validation(`${key} is required.`);
  }

  return trimmed;
}

export function description(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length > 2000) {
    validation("description must be 2000 characters or fewer.");
  }

  return trimmed.length === 0 ? null : trimmed;
}

export function optionalDescription(body: Body) {
  return has(body, "description") ? description(optionalString(body, "description")) : null;
}

export function sourceRef(body: Body) {
  if (!has(body, "sourceRef") || body.sourceRef === null) {
    return null;
  }

  const value = requireString(body, "sourceRef").trim();
  if (value.length < 1 || value.length > 200) {
    validation("sourceRef must be 1 to 200 characters.");
  }

  return value;
}

export function requireDecimal(body: Body, key: string) {
  const value = body[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/.test(value)) {
    return Number(value);
  }

  validation(`${key} must be a number.`);
}

export function optionalDecimal(body: Body, key: string) {
  if (!has(body, key) || body[key] === null) {
    return null;
  }

  return requireDecimal(body, key);
}

function shiftedRound(text: string, digits: number) {
  const value = Number(text);
  const sign = value < 0 ? -1 : 1;
  const magnitude = text.replace(/^[+-]/, "");
  const shifted = /e/i.test(magnitude) ? Math.abs(value) * 10 ** digits : Number(`${magnitude}e${digits}`);
  return sign * Math.round(shifted);
}

export function roundMoney(value: number) {
  return shiftedRound(String(value), 2) / 100;
}

export function cents(value: number | { toString(): string }) {
  return shiftedRound(value.toString(), 2);
}

export function inKindFromMinutes(durationMinutes: number, hourlyRate: number) {
  return Math.round((durationMinutes * cents(hourlyRate)) / 60) / 100;
}

export function collectiveInKind(startedAt: Date, endedAt: Date, participantCount: number, hourlyRate: number) {
  const seconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
  return Math.round((seconds * participantCount * cents(hourlyRate)) / 3600) / 100;
}

export function hoursFromMinutes(minutes: number) {
  return Math.round((minutes * 100000) / 60) / 100000;
}

export function assertDurationMinutes(durationMinutes: number) {
  if (durationMinutes < 1 || durationMinutes > 1440) {
    validation("durationMinutes must be from 1 to 1440.");
  }
}

export function assertTotalMinutes(durationMinutes: number) {
  if (durationMinutes < 1 || durationMinutes > 59940) {
    validation("durationMinutes must be from 1 to 59940.");
  }
}
