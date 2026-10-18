using System.Text.Json.Nodes;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Features.Projects;

public sealed record ProjectDto(
    Guid Id,
    Guid OrganizationId,
    Guid? DepartmentId,
    Guid OwnerUserId,
    string Title,
    string? Description,
    string AccessType,
    string ProjectType,
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool IsActive,
    Guid[] EditorIds)
{
    public static ProjectDto From(Project project) => new(
        project.Id,
        project.OrganizationId,
        project.DepartmentId,
        project.OwnerUserId,
        project.Title,
        project.Description,
        project.AccessType.ToString(),
        project.ProjectType.ToString(),
        project.StartDate,
        project.EndDate,
        project.IsActive,
        project.Editors.Select(user => user.Id).Order().ToArray());
}

public sealed record CreateProjectRequest(
    AccessType AccessType,
    ProjectType ProjectType,
    Guid? DepartmentId,
    DateOnly? StartDate,
    DateOnly? EndDate,
    List<Guid> EditorIds,
    string Title,
    string? Description,
    bool IsActive)
{
    public static async ValueTask<CreateProjectRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static CreateProjectRequest Parse(JsonObject body) => new(
        Fields.NormalizeAccessType(Fields.RequiredString(body, "accessType")),
        Fields.Has(body, "projectType") ? Fields.NormalizeProjectType(Fields.RequiredString(body, "projectType")) : ProjectType.Project,
        Fields.OptionalGuid(body, "departmentId"),
        Fields.OptionalDate(body, "startDate"),
        Fields.OptionalDate(body, "endDate"),
        Fields.Ids(body, "editorIds", optional: true),
        Fields.RequireName(Fields.RequiredString(body, "title"), "title"),
        Fields.OptionalDescription(body),
        !Fields.Has(body, "isActive") || Fields.RequiredBool(body, "isActive"));
}

public sealed record UpdateProjectRequest(
    Optional<AccessType> AccessType,
    Optional<ProjectType> ProjectType,
    Optional<Guid?> DepartmentId,
    Optional<DateOnly?> StartDate,
    Optional<DateOnly?> EndDate,
    Optional<string> Title,
    Optional<string?> Description,
    Optional<bool> IsActive,
    Optional<List<Guid>> EditorIds)
{
    public static async ValueTask<UpdateProjectRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static UpdateProjectRequest Parse(JsonObject body)
    {
        var request = new UpdateProjectRequest(
            Optional.Read(body, "accessType", (b, k) => Fields.NormalizeAccessType(Fields.RequiredString(b, k))),
            Optional.Read(body, "projectType", (b, k) => Fields.NormalizeProjectType(Fields.RequiredString(b, k))),
            Optional.Read(body, "departmentId", Fields.OptionalGuid),
            Optional.Read(body, "startDate", Fields.OptionalDate),
            Optional.Read(body, "endDate", Fields.OptionalDate),
            Optional.Read(body, "title", (b, k) => Fields.RequireName(Fields.RequiredString(b, k), k)),
            Optional.Read(body, "description", (b, k) => Fields.Description(Fields.OptionalString(b, k))),
            Optional.Read(body, "isActive", Fields.RequiredBool),
            Optional.Read(body, "editorIds", (b, k) => Fields.Ids(b, k, optional: false)));
        if (!request.AccessType.HasValue
            && !request.ProjectType.HasValue
            && !request.DepartmentId.HasValue
            && !request.StartDate.HasValue
            && !request.EndDate.HasValue
            && !request.Title.HasValue
            && !request.Description.HasValue
            && !request.IsActive.HasValue
            && !request.EditorIds.HasValue)
        {
            throw ApiException.Validation("Provide at least one field to update.");
        }

        return request;
    }
}
