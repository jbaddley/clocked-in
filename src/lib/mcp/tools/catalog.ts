import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createDepartment, deleteDepartment, listDepartments, updateDepartment } from "@/lib/api/features/departments";
import {
  createHourlyRate,
  deleteHourlyRate,
  listHourlyRates,
  parseCreateHourlyRate,
  parseUpdateHourlyRate,
  updateHourlyRate,
} from "@/lib/api/features/hourly-rates";
import { parseName } from "@/lib/api/features/organizations";
import { createTag, deleteTag, listTags, updateTag } from "@/lib/api/features/tags";
import {
  createTaskCategory,
  deleteTaskCategory,
  listTaskCategories,
  updateTaskCategory,
} from "@/lib/api/features/task-categories";
import { createTheme, deleteTheme, listThemes, parseThemeWrite, updateTheme } from "@/lib/api/features/themes";
import { jsonBody, query } from "@/lib/mcp/call";
import { mcpAccess } from "@/lib/mcp/context";
import { guid, tool } from "@/lib/mcp/tool";

const page = { limit: z.number().int().nullable(), offset: z.number().int().nullable() };
const name = { name: z.string() };

export function registerCatalogTools(server: McpServer) {
  tool(server, "list_departments", "List departments in an organization.", { organizationId: guid, ...page }, ({ organizationId, limit, offset }) =>
    listDepartments(mcpAccess(), organizationId, query({ limit, offset })),
  );
  tool(server, "create_department", "Create a department.", { organizationId: guid, ...name }, ({ organizationId, name: departmentName }) =>
    createDepartment(mcpAccess(), organizationId, parseName({ name: departmentName })),
  );
  tool(server, "update_department", "Rename a department.", { departmentId: guid, ...name }, ({ departmentId, name: departmentName }) =>
    updateDepartment(mcpAccess(), departmentId, parseName({ name: departmentName })),
  );
  tool(server, "delete_department", "Delete a department.", { departmentId: guid }, async ({ departmentId }) => {
    await deleteDepartment(mcpAccess(), departmentId);
    return "deleted";
  });

  tool(server, "list_tags", "List tags in an organization.", { organizationId: guid, ...page }, ({ organizationId, limit, offset }) =>
    listTags(mcpAccess(), organizationId, query({ limit, offset })),
  );
  tool(server, "create_tag", "Create a tag.", { organizationId: guid, ...name }, ({ organizationId, name: tagName }) =>
    createTag(mcpAccess(), organizationId, parseName({ name: tagName })),
  );
  tool(server, "update_tag", "Rename a tag.", { tagId: guid, ...name }, ({ tagId, name: tagName }) =>
    updateTag(mcpAccess(), tagId, parseName({ name: tagName })),
  );
  tool(server, "delete_tag", "Delete a tag.", { tagId: guid }, async ({ tagId }) => {
    await deleteTag(mcpAccess(), tagId);
    return "deleted";
  });

  tool(
    server,
    "list_task_categories",
    "List task categories in an organization.",
    { organizationId: guid, ...page },
    ({ organizationId, limit, offset }) => listTaskCategories(mcpAccess(), organizationId, query({ limit, offset })),
  );
  tool(
    server,
    "create_task_category",
    "Create a task category.",
    { organizationId: guid, ...name },
    ({ organizationId, name: categoryName }) => createTaskCategory(mcpAccess(), organizationId, parseName({ name: categoryName })),
  );
  tool(
    server,
    "update_task_category",
    "Rename a task category.",
    { taskCategoryId: guid, ...name },
    ({ taskCategoryId, name: categoryName }) => updateTaskCategory(mcpAccess(), taskCategoryId, parseName({ name: categoryName })),
  );
  tool(server, "delete_task_category", "Delete a task category.", { taskCategoryId: guid }, async ({ taskCategoryId }) => {
    await deleteTaskCategory(mcpAccess(), taskCategoryId);
    return "deleted";
  });

  tool(
    server,
    "list_hourly_rates",
    "List hourly rates in an organization.",
    { organizationId: guid, ...page },
    ({ organizationId, limit, offset }) => listHourlyRates(mcpAccess(), organizationId, query({ limit, offset })),
  );
  tool(
    server,
    "create_hourly_rate",
    "Create an hourly rate. Pass JSON with type, name, perHourRate, and optional isDefault, isArchived, and source.",
    { organizationId: guid, body: z.string() },
    ({ organizationId, body }) => createHourlyRate(mcpAccess(), organizationId, parseCreateHourlyRate(jsonBody(body))),
  );
  tool(
    server,
    "update_hourly_rate",
    "Update an hourly rate. Pass JSON with any of type, name, perHourRate, isDefault, isArchived, and source.",
    { hourlyRateId: guid, body: z.string() },
    ({ hourlyRateId, body }) => updateHourlyRate(mcpAccess(), hourlyRateId, parseUpdateHourlyRate(jsonBody(body))),
  );
  tool(server, "delete_hourly_rate", "Delete an hourly rate.", { hourlyRateId: guid }, async ({ hourlyRateId }) => {
    await deleteHourlyRate(mcpAccess(), hourlyRateId);
    return "deleted";
  });

  tool(server, "list_themes", "List global and organization themes.", { organizationId: guid }, ({ organizationId }) =>
    listThemes(mcpAccess(), organizationId),
  );
  tool(
    server,
    "create_theme",
    "Create an organization theme. Pass JSON matching the theme write body.",
    { organizationId: guid, body: z.string() },
    ({ organizationId, body }) => createTheme(mcpAccess(), organizationId, parseThemeWrite(jsonBody(body))),
  );
  tool(
    server,
    "update_theme",
    "Update an organization theme.",
    { organizationId: guid, themeId: guid, body: z.string() },
    ({ organizationId, themeId, body }) => updateTheme(mcpAccess(), organizationId, themeId, parseThemeWrite(jsonBody(body))),
  );
  tool(server, "delete_theme", "Delete an organization theme.", { organizationId: guid, themeId: guid }, async ({ organizationId, themeId }) => {
    await deleteTheme(mcpAccess(), organizationId, themeId);
    return "deleted";
  });
}
