using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Organizations;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Departments;

public sealed record DepartmentDto(Guid Id, Guid OrganizationId, string Name)
{
    public static DepartmentDto From(Department department) => new(department.Id, department.OrganizationId, department.Name);
}

public sealed class DepartmentsService(ClockedInDbContext db, Access access)
{
    public async Task<ListResponse<DepartmentDto>> List(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var departments = await db.Departments.AsNoTracking()
            .Where(department => department.OrganizationId == organizationId)
            .OrderBy(department => department.Name)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(departments.Select(DepartmentDto.From).ToList(), page);
    }

    public async Task<DepartmentDto> Create(Guid organizationId, NameRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, true, cancellationToken);
        var department = new Department { Id = Guid.NewGuid(), OrganizationId = organizationId, Name = request.Name };
        db.Departments.Add(department);
        await db.SaveOrThrowAsync(cancellationToken);
        return DepartmentDto.From(department);
    }

    public async Task<DepartmentDto> Get(Guid departmentId, CancellationToken cancellationToken) =>
        DepartmentDto.From(await access.RequireDepartment(departmentId, cancellationToken));

    public async Task<DepartmentDto> Update(Guid departmentId, NameRequest request, CancellationToken cancellationToken)
    {
        var department = await Managed(departmentId, cancellationToken);
        department.Name = request.Name;
        await db.SaveOrThrowAsync(cancellationToken);
        return DepartmentDto.From(department);
    }

    public async Task Delete(Guid departmentId, CancellationToken cancellationToken)
    {
        var department = await Managed(departmentId, cancellationToken);
        if (await db.UserTimeEntries.AnyAsync(entry => entry.DepartmentId == departmentId, cancellationToken)
            || await db.CollectiveTimeEntries.AnyAsync(entry => entry.DepartmentId == departmentId, cancellationToken))
        {
            throw ApiException.Conflict("Delete the time entries first.");
        }

        db.Departments.Remove(department);
        await db.SaveOrThrowAsync(cancellationToken);
    }

    private async Task<Department> Managed(Guid departmentId, CancellationToken cancellationToken)
    {
        var department = await db.Departments.FirstOrDefaultAsync(item => item.Id == departmentId, cancellationToken)
            ?? throw ApiException.NotFound();
        await access.RequireOrganization(department.OrganizationId, true, cancellationToken);
        return department;
    }
}

public static class DepartmentsEndpoints
{
    public static void MapDepartmentsEndpoints(this IEndpointRouteBuilder app)
    {
        var byOrganization = app.MapGroup("/organizations/{id:guid}/departments").RequireAuthorization();
        byOrganization.MapGet("", async Task<Ok<ListResponse<DepartmentDto>>> (Guid id, [AsParameters] PageQuery query, DepartmentsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, query, ct)));
        byOrganization.MapPost("", async Task<Created<DepartmentDto>> (Guid id, NameRequest request, DepartmentsService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(id, request, ct)));

        var departments = app.MapGroup("/departments").RequireAuthorization();
        departments.MapGet("/{id:guid}", async Task<Ok<DepartmentDto>> (Guid id, DepartmentsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Get(id, ct)));
        departments.MapPatch("/{id:guid}", async Task<Ok<DepartmentDto>> (Guid id, NameRequest request, DepartmentsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, request, ct)));
        departments.MapDelete("/{id:guid}", async Task<NoContent> (Guid id, DepartmentsService service, CancellationToken ct) =>
        {
            await service.Delete(id, ct);
            return TypedResults.NoContent();
        });
    }
}
