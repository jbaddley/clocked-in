using System.ComponentModel;
using ClockedIn.Api.Features.Organizations;
using ClockedIn.Api.Http;
using ModelContextProtocol.Server;

namespace ClockedIn.Api.Mcp;

[McpServerToolType]
public sealed class OrganizationTools(OrganizationsService organizations)
{
    [McpServerTool, Description("List organizations the caller can access.")]
    public Task<ListResponse<OrganizationDto>> ListOrganizations(int? limit, int? offset, CancellationToken cancellationToken) =>
        McpCall.Run(() => organizations.List(new PageQuery(limit?.ToString(), offset?.ToString()), cancellationToken));

    [McpServerTool, Description("Get an organization by id.")]
    public Task<OrganizationDto> GetOrganization(Guid organizationId, CancellationToken cancellationToken) =>
        McpCall.Run(() => organizations.Get(organizationId, cancellationToken));

    [McpServerTool, Description("Update an organization. Pass a JSON object with fields such as name, description, websiteUrl, volunteerHourlyRate, rateSourceYear, defaultRateType, preferences, and themeId.")]
    public Task<OrganizationDto> UpdateOrganization(Guid organizationId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => organizations.Update(organizationId, UpdateOrganizationRequest.Parse(McpCall.Object(body)), cancellationToken));
}
