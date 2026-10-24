using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Connections;

public sealed class ConnectionsService(ClockedInDbContext db, Access access, TimeProvider time)
{
    public async Task<ListResponse<ConnectionDto>> List(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var admin = access.IsSuperAdmin || await access.IsOrgAdmin(organizationId, cancellationToken);
        var actorId = access.ActorUserId;
        var connections = await db.MemberConnections.AsNoTracking()
            .Include(connection => connection.UserA).ThenInclude(user => user.Profile)
            .Include(connection => connection.UserB).ThenInclude(user => user.Profile)
            .Where(connection => connection.OrganizationId == organizationId)
            .Where(connection => admin || connection.UserAId == actorId || connection.UserBId == actorId)
            .OrderBy(connection => connection.CreatedAt)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(connections.Select(ConnectionDto.From).ToList(), page);
    }

    public async Task<ConnectionDto> Create(Guid organizationId, CreateConnectionRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await AssertActiveMember(organizationId, request.UserId, cancellationToken);
        await AssertActiveMember(organizationId, request.ConnectedUserId, cancellationToken);
        var saved = await Insert(
            organizationId,
            request.UserId,
            request.ConnectedUserId,
            request.Relationship,
            access.ActorUserId,
            cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return ConnectionDto.From(saved);
    }

    public async Task<ConnectionDto> Update(
        Guid organizationId,
        Guid connectionId,
        UpdateConnectionRequest request,
        CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var connection = await db.MemberConnections
            .Include(item => item.UserA).ThenInclude(user => user.Profile)
            .Include(item => item.UserB).ThenInclude(user => user.Profile)
            .FirstOrDefaultAsync(item => item.Id == connectionId && item.OrganizationId == organizationId, cancellationToken)
            ?? throw ApiException.NotFound();
        if (request.UserId != connection.UserAId && request.UserId != connection.UserBId)
        {
            throw ApiException.Validation("userId must be one of the connected people.");
        }

        var otherUserId = request.UserId == connection.UserAId ? connection.UserBId : connection.UserAId;
        var canonical = MemberConnectionRules.Canonical(request.UserId, otherUserId, request.Relationship);
        connection.Relationship = canonical.Relationship;
        await db.SaveOrThrowAsync(cancellationToken);
        return ConnectionDto.From(connection);
    }

    public async Task Delete(Guid organizationId, Guid connectionId, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var connection = await db.MemberConnections
            .FirstOrDefaultAsync(item => item.Id == connectionId && item.OrganizationId == organizationId, cancellationToken)
            ?? throw ApiException.NotFound();
        db.MemberConnections.Remove(connection);
        await db.SaveOrThrowAsync(cancellationToken);
    }

    public async Task<MemberConnection> Insert(
        Guid organizationId,
        Guid fromUserId,
        Guid toUserId,
        MemberRelationship relationship,
        Guid createdByUserId,
        CancellationToken cancellationToken)
    {
        var canonical = MemberConnectionRules.Canonical(fromUserId, toUserId, relationship);
        if (await db.MemberConnections.AnyAsync(
            item => item.OrganizationId == organizationId && item.UserAId == canonical.UserAId && item.UserBId == canonical.UserBId,
            cancellationToken))
        {
            throw ApiException.Conflict("These people are already connected.");
        }

        var connection = new MemberConnection
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            UserAId = canonical.UserAId,
            UserBId = canonical.UserBId,
            Relationship = canonical.Relationship,
            CreatedByUserId = createdByUserId,
            CreatedAt = time.UtcNow(),
        };
        db.MemberConnections.Add(connection);
        await db.SaveOrThrowAsync(cancellationToken);
        await db.Entry(connection).Reference(item => item.UserA).Query().Include(user => user.Profile).LoadAsync(cancellationToken);
        await db.Entry(connection).Reference(item => item.UserB).Query().Include(user => user.Profile).LoadAsync(cancellationToken);
        return connection;
    }

    public async Task<bool> VolunteerConnectedTo(Guid organizationId, Guid otherUserId, CancellationToken cancellationToken)
    {
        if (access.IsApiKey || access.IsSuperAdmin || access.ActorUserId == otherUserId)
        {
            return false;
        }

        if (!await access.IsOrgVolunteer(organizationId, cancellationToken))
        {
            return false;
        }

        var (userAId, userBId) = MemberConnectionRules.Order(access.ActorUserId, otherUserId);
        return await db.MemberConnections.AnyAsync(
            item => item.OrganizationId == organizationId && item.UserAId == userAId && item.UserBId == userBId,
            cancellationToken);
    }

    public async Task<List<Guid>> VolunteerConnectedOrganizationIds(Guid otherUserId, CancellationToken cancellationToken)
    {
        if (access.IsApiKey || access.IsSuperAdmin || access.ActorUserId == otherUserId)
        {
            return [];
        }

        var actorId = access.ActorUserId;
        var organizationIds = await db.MemberConnections.AsNoTracking()
            .Where(item => (item.UserAId == actorId && item.UserBId == otherUserId) || (item.UserAId == otherUserId && item.UserBId == actorId))
            .Select(item => item.OrganizationId)
            .ToListAsync(cancellationToken);
        var connected = new List<Guid>();
        foreach (var organizationId in organizationIds)
        {
            if (await access.IsOrgVolunteer(organizationId, cancellationToken))
            {
                connected.Add(organizationId);
            }
        }

        return connected;
    }

    private async Task AssertActiveMember(Guid organizationId, Guid userId, CancellationToken cancellationToken)
    {
        var member = await db.OrganizationMemberships.AnyAsync(
            item => item.OrganizationId == organizationId && item.UserId == userId && item.IsActive,
            cancellationToken);
        if (!member)
        {
            throw ApiException.Validation("Both people must be active members of this organization.");
        }
    }
}
