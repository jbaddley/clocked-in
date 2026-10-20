using System.ComponentModel;
using ClockedIn.Api.Features.Projects;
using ClockedIn.Api.Http;
using ModelContextProtocol.Server;

namespace ClockedIn.Api.Mcp;

[McpServerToolType]
public sealed class ProjectTools(ProjectsService projects)
{
    [McpServerTool, Description("List projects in an organization that the caller can see.")]
    public Task<ListResponse<ProjectDto>> ListProjects(Guid organizationId, int? limit, int? offset, CancellationToken cancellationToken) =>
        McpCall.Run(() => projects.List(organizationId, new PageQuery(limit?.ToString(), offset?.ToString()), cancellationToken));

    [McpServerTool, Description("Get a project by id.")]
    public Task<ProjectDto> GetProject(Guid projectId, CancellationToken cancellationToken) =>
        McpCall.Run(() => projects.Get(projectId, cancellationToken));

    [McpServerTool, Description("Create a project. Pass JSON with title, accessType, and optional projectType, departmentId, description, startDate, endDate, isActive, editorIds.")]
    public Task<ProjectDto> CreateProject(Guid organizationId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => projects.Create(organizationId, CreateProjectRequest.Parse(McpCall.Object(body)), cancellationToken));

    [McpServerTool, Description("Update a project. Pass JSON with any writable project fields.")]
    public Task<ProjectDto> UpdateProject(Guid projectId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => projects.Update(projectId, UpdateProjectRequest.Parse(McpCall.Object(body)), cancellationToken));

    [McpServerTool, Description("Delete a project.")]
    public Task<string> DeleteProject(Guid projectId, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            await projects.Delete(projectId, cancellationToken);
            return "deleted";
        });
}
