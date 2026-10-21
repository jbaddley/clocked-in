using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace ClockedIn.Api.Features.Memberships;

public static class MembershipsEndpoints
{
    public static void MapMembershipsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/roles", async Task<Ok<ListResponse<RoleDto>>> ([AsParameters] PageQuery query, MembershipsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.ListRoles(query, ct))).RequireAuthorization();

        var organization = app.MapGroup("/organizations/{id:guid}/memberships").RequireAuthorization();
        organization.MapGet("", async Task<Ok<ListResponse<MembershipDto>>> (Guid id, [AsParameters] PageQuery query, MembershipsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.ListOrganization(id, query, ct)));
        organization.MapPost("", async Task<Created<MembershipDto>> (Guid id, CreateOrgMembershipRequest request, MembershipsService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.CreateOrganization(id, request, ct)));
        organization.MapPatch("/{membershipId:guid}", async Task<Ok<MembershipDto>> (Guid id, Guid membershipId, UpdateOrgMembershipRequest request, MembershipsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.UpdateOrganization(id, membershipId, request, ct)));
        organization.MapDelete("/{membershipId:guid}", async Task<NoContent> (Guid id, Guid membershipId, MembershipsService service, CancellationToken ct) =>
        {
            await service.DeleteOrganization(id, membershipId, ct);
            return TypedResults.NoContent();
        });
        organization.MapDelete("", async Task<NoContent> (Guid id, DeleteOrgMembershipsRequest request, MembershipsService service, CancellationToken ct) =>
        {
            await service.DeleteOrganizations(id, request.MembershipIds, ct);
            return TypedResults.NoContent();
        });

        var department = app.MapGroup("/departments/{id:guid}/memberships").RequireAuthorization();
        department.MapGet("", async Task<Ok<ListResponse<MembershipDto>>> (Guid id, [AsParameters] PageQuery query, MembershipsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.ListDepartment(id, query, ct)));
        department.MapPatch("/{membershipId:guid}", async Task<Ok<MembershipDto>> (Guid id, Guid membershipId, UpdateDepartmentMembershipRequest request, MembershipsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.UpdateDepartment(id, membershipId, request, ct)));
        department.MapDelete("/{membershipId:guid}", async Task<NoContent> (Guid id, Guid membershipId, MembershipsService service, CancellationToken ct) =>
        {
            await service.DeleteDepartment(id, membershipId, ct);
            return TypedResults.NoContent();
        });
    }
}
