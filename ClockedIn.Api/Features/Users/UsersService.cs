using ClockedIn.Api.Data;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Users;

public sealed class UsersService(ClockedInDbContext db, Access access, TimeProvider time)
{
    public async Task<ListResponse<UserDto>> List(PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        if (!access.Caller.IsSuperAdmin)
        {
            throw ApiException.Forbidden();
        }

        var users = await db.UsersWithProfile().AsNoTracking()
            .OrderBy(user => user.Username)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(users.Select(user => UserDto.From(user)).ToList(), page);
    }

    public async Task<UserDto> Get(Guid userId, CancellationToken cancellationToken)
    {
        var caller = access.Caller;
        var user = await db.UsersWithProfile().AsNoTracking().FirstOrDefaultAsync(item => item.Id == userId, cancellationToken)
            ?? throw ApiException.NotFound();
        if (caller.IsSuperAdmin || caller.Id == user.Id)
        {
            return UserDto.From(user);
        }

        var shared = await access.SharedOrganizationIds(user.Id, cancellationToken);
        if (shared.Count == 0)
        {
            throw ApiException.Forbidden();
        }

        var adminOfShared = false;
        foreach (var organizationId in shared)
        {
            adminOfShared |= await access.IsOrgAdmin(organizationId, cancellationToken);
        }

        return UserDto.From(user, adminOfShared);
    }

    public async Task<UserDto> Update(Guid userId, UpdateUserRequest request, bool fromMe, CancellationToken cancellationToken)
    {
        var caller = access.Caller;
        var user = await db.UsersWithProfile().FirstOrDefaultAsync(item => item.Id == userId, cancellationToken)
            ?? throw ApiException.NotFound();
        if (user.Profile is null)
        {
            throw ApiException.NotFound();
        }

        if (caller.Id != user.Id && !caller.IsSuperAdmin)
        {
            var adminOfShared = false;
            foreach (var organizationId in await access.SharedOrganizationIds(user.Id, cancellationToken))
            {
                adminOfShared |= await access.IsOrgAdmin(organizationId, cancellationToken);
            }

            if (!adminOfShared)
            {
                throw ApiException.Forbidden();
            }

            if (request.Username.HasValue || request.Email.HasValue || request.Password.HasValue || request.IsSuperAdmin.HasValue)
            {
                throw ApiException.Forbidden();
            }
        }

        if (request.IsSuperAdmin.HasValue && (fromMe || !caller.IsSuperAdmin))
        {
            throw ApiException.Forbidden();
        }

        if (caller.MustChangePassword && caller.Id == user.Id && !request.Password.HasValue)
        {
            throw ApiException.PasswordChangeRequired();
        }

        if (request.Password.HasValue && !Passwords.Verify(request.CurrentPassword!, user.PasswordHash))
        {
            throw ApiException.Validation("The current password is incorrect.");
        }

        if (user.MustChangePassword && request.Password.HasValue && Passwords.Verify(request.Password.Value, user.PasswordHash))
        {
            throw ApiException.Validation("Choose a different password.");
        }

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        user.Username = request.Username.Or(user.Username);
        user.Email = request.Email.Or(user.Email);
        if (request.Password.HasValue)
        {
            user.PasswordHash = Passwords.Hash(request.Password.Value);
            user.MustChangePassword = false;
        }

        user.Profile.FirstName = request.FirstName.Or(user.Profile.FirstName);
        user.Profile.LastName = request.LastName.Or(user.Profile.LastName);
        user.Profile.DisplayName = request.DisplayName.Or(user.Profile.DisplayName);
        user.Profile.Timezone = request.Timezone.Or(user.Profile.Timezone);
        user.Profile.Phone = request.Phone.Or(user.Profile.Phone);
        user.Profile.ZipCode = request.ZipCode.Or(user.Profile.ZipCode);
        user.Profile.Notes = request.Notes.Or(user.Profile.Notes);
        if (request.IsSuperAdmin.HasValue)
        {
            if (!request.IsSuperAdmin.Value && user.IsSuperAdmin)
            {
                await db.LockSuperAdminsAsync(cancellationToken);
                await AssertSuperAdminRemains(user.Id, cancellationToken);
            }

            user.IsSuperAdmin = request.IsSuperAdmin.Value;
        }

        if (request.Password.HasValue)
        {
            var now = time.UtcNow();
            await db.RefreshTokens
                .Where(token => token.UserId == user.Id && token.RevokedAt == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(token => token.RevokedAt, now), cancellationToken);
        }

        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return UserDto.From(user);
    }

    public async Task Delete(Guid userId, CancellationToken cancellationToken)
    {
        var caller = access.Caller;
        var user = await db.Users.FirstOrDefaultAsync(item => item.Id == userId, cancellationToken) ?? throw ApiException.NotFound();
        if (caller.Id != user.Id && !caller.IsSuperAdmin)
        {
            throw ApiException.Forbidden();
        }

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        if (user.IsSuperAdmin)
        {
            await db.LockSuperAdminsAsync(cancellationToken);
            await AssertSuperAdminRemains(user.Id, cancellationToken);
        }

        var referenced = await db.UserTimeEntries.AnyAsync(entry => entry.UserId == userId || entry.EnteredByUserId == userId, cancellationToken)
            || await db.CollectiveTimeEntries.AnyAsync(entry => entry.RecordedByUserId == userId, cancellationToken)
            || await db.Projects.AnyAsync(project => project.OwnerUserId == userId, cancellationToken);
        if (referenced)
        {
            throw ApiException.Conflict("Delete the time entries first.");
        }

        db.Users.Remove(user);
        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
    }

    private async Task AssertSuperAdminRemains(Guid exceptUserId, CancellationToken cancellationToken)
    {
        if (!await db.Users.AnyAsync(user => user.IsSuperAdmin && user.Id != exceptUserId, cancellationToken))
        {
            throw ApiException.Conflict("The last SuperAdmin cannot be removed.");
        }
    }
}
