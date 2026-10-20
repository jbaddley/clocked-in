using System.ComponentModel;
using ClockedIn.Api.Features.Departments;
using ClockedIn.Api.Features.HourlyRates;
using ClockedIn.Api.Features.Organizations;
using ClockedIn.Api.Features.Tags;
using ClockedIn.Api.Features.TaskCategories;
using ClockedIn.Api.Features.Themes;
using ClockedIn.Api.Http;
using ModelContextProtocol.Server;

namespace ClockedIn.Api.Mcp;

[McpServerToolType]
public sealed class CatalogTools(
    DepartmentsService departments,
    TagsService tags,
    TaskCategoriesService categories,
    HourlyRatesService rates,
    ThemesService themes)
{
    [McpServerTool, Description("List departments in an organization.")]
    public Task<ListResponse<DepartmentDto>> ListDepartments(Guid organizationId, int? limit, int? offset, CancellationToken cancellationToken) =>
        McpCall.Run(() => departments.List(organizationId, new PageQuery(limit?.ToString(), offset?.ToString()), cancellationToken));

    [McpServerTool, Description("Create a department.")]
    public Task<DepartmentDto> CreateDepartment(Guid organizationId, string name, CancellationToken cancellationToken) =>
        McpCall.Run(() => departments.Create(organizationId, new NameRequest(name), cancellationToken));

    [McpServerTool, Description("Rename a department.")]
    public Task<DepartmentDto> UpdateDepartment(Guid departmentId, string name, CancellationToken cancellationToken) =>
        McpCall.Run(() => departments.Update(departmentId, new NameRequest(name), cancellationToken));

    [McpServerTool, Description("Delete a department.")]
    public Task<string> DeleteDepartment(Guid departmentId, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            await departments.Delete(departmentId, cancellationToken);
            return "deleted";
        });

    [McpServerTool, Description("List tags in an organization.")]
    public Task<ListResponse<TagDto>> ListTags(Guid organizationId, int? limit, int? offset, CancellationToken cancellationToken) =>
        McpCall.Run(() => tags.List(organizationId, new PageQuery(limit?.ToString(), offset?.ToString()), cancellationToken));

    [McpServerTool, Description("Create a tag.")]
    public Task<TagDto> CreateTag(Guid organizationId, string name, CancellationToken cancellationToken) =>
        McpCall.Run(() => tags.Create(organizationId, new NameRequest(name), cancellationToken));

    [McpServerTool, Description("Rename a tag.")]
    public Task<TagDto> UpdateTag(Guid tagId, string name, CancellationToken cancellationToken) =>
        McpCall.Run(() => tags.Update(tagId, new NameRequest(name), cancellationToken));

    [McpServerTool, Description("Delete a tag.")]
    public Task<string> DeleteTag(Guid tagId, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            await tags.Delete(tagId, cancellationToken);
            return "deleted";
        });

    [McpServerTool, Description("List task categories in an organization.")]
    public Task<ListResponse<TaskCategoryDto>> ListTaskCategories(Guid organizationId, int? limit, int? offset, CancellationToken cancellationToken) =>
        McpCall.Run(() => categories.List(organizationId, new PageQuery(limit?.ToString(), offset?.ToString()), cancellationToken));

    [McpServerTool, Description("Create a task category.")]
    public Task<TaskCategoryDto> CreateTaskCategory(Guid organizationId, string name, CancellationToken cancellationToken) =>
        McpCall.Run(() => categories.Create(organizationId, new NameRequest(name), cancellationToken));

    [McpServerTool, Description("Rename a task category.")]
    public Task<TaskCategoryDto> UpdateTaskCategory(Guid taskCategoryId, string name, CancellationToken cancellationToken) =>
        McpCall.Run(() => categories.Update(taskCategoryId, new NameRequest(name), cancellationToken));

    [McpServerTool, Description("Delete a task category.")]
    public Task<string> DeleteTaskCategory(Guid taskCategoryId, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            await categories.Delete(taskCategoryId, cancellationToken);
            return "deleted";
        });

    [McpServerTool, Description("List hourly rates in an organization.")]
    public Task<ListResponse<HourlyRateDto>> ListHourlyRates(Guid organizationId, int? limit, int? offset, CancellationToken cancellationToken) =>
        McpCall.Run(() => rates.List(organizationId, new PageQuery(limit?.ToString(), offset?.ToString()), cancellationToken));

    [McpServerTool, Description("Create an hourly rate. Pass JSON with type, name, perHourRate, and optional isDefault, isArchived, and source.")]
    public Task<HourlyRateDto> CreateHourlyRate(Guid organizationId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => rates.Create(organizationId, CreateHourlyRateRequest.Parse(McpCall.Object(body)), cancellationToken));

    [McpServerTool, Description("Update an hourly rate. Pass JSON with any of type, name, perHourRate, isDefault, isArchived, and source.")]
    public Task<HourlyRateDto> UpdateHourlyRate(Guid hourlyRateId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => rates.Update(hourlyRateId, UpdateHourlyRateRequest.Parse(McpCall.Object(body)), cancellationToken));

    [McpServerTool, Description("Delete an hourly rate.")]
    public Task<string> DeleteHourlyRate(Guid hourlyRateId, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            await rates.Delete(hourlyRateId, cancellationToken);
            return "deleted";
        });

    [McpServerTool, Description("List global and organization themes.")]
    public Task<ListResponse<ThemeDto>> ListThemes(Guid organizationId, CancellationToken cancellationToken) =>
        McpCall.Run(() => themes.List(organizationId, cancellationToken));

    [McpServerTool, Description("Create an organization theme. Pass JSON matching the theme write body.")]
    public Task<ThemeDto> CreateTheme(Guid organizationId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => themes.Create(organizationId, ThemeWriteRequest.Parse(McpCall.Object(body)), cancellationToken));

    [McpServerTool, Description("Update an organization theme.")]
    public Task<ThemeDto> UpdateTheme(Guid organizationId, Guid themeId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => themes.Update(organizationId, themeId, ThemeWriteRequest.Parse(McpCall.Object(body)), cancellationToken));

    [McpServerTool, Description("Delete an organization theme.")]
    public Task<string> DeleteTheme(Guid organizationId, Guid themeId, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            await themes.Delete(organizationId, themeId, cancellationToken);
            return "deleted";
        });
}
