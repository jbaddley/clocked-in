import { authenticate } from "@/lib/api/access";
import { deleteProject, getProject, parseUpdateProject, updateProject } from "@/lib/api/features/projects";
import { withGuids } from "@/lib/api/guid";
import { readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) => getProject(await authenticate(request), id));

export const PATCH = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return updateProject(access, id, parseUpdateProject(await readBody(request)));
});

export const DELETE = withGuids<{ id: string }>(async (request, { id }) => {
  await deleteProject(await authenticate(request), id);
}, 204);
