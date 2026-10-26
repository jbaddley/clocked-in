using ClockedIn.Api.Entities;
using ClockedIn.Api.Http;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ClockedIn.Api.Data;

public static class DbExtensions
{
    public static IQueryable<User> UsersWithProfile(this ClockedInDbContext db) =>
        db.Users.Include(user => user.Profile);

    public static async Task SaveOrThrowAsync(this ClockedInDbContext db, CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException postgres)
        {
            throw Translate(postgres) ?? (Exception)exception;
        }
    }

    public static async Task LockUserAsync(this ClockedInDbContext db, Guid userId, CancellationToken cancellationToken)
    {
        await db.Database.SqlQueryRaw<Guid>(
            """SELECT "id" AS "Value" FROM "User" WHERE "id" = {0} FOR UPDATE""",
            userId).ToListAsync(cancellationToken);
    }

    public static async Task LockVolunteerNeedAsync(this ClockedInDbContext db, Guid needId, CancellationToken cancellationToken)
    {
        await db.Database.SqlQueryRaw<Guid>(
            """SELECT "id" AS "Value" FROM "VolunteerNeed" WHERE "id" = {0} FOR UPDATE""",
            needId).ToListAsync(cancellationToken);
    }

    public static async Task LockOrganizationAsync(this ClockedInDbContext db, Guid organizationId, CancellationToken cancellationToken)
    {
        await db.Database.SqlQueryRaw<Guid>(
            """SELECT "id" AS "Value" FROM "Organization" WHERE "id" = {0} FOR UPDATE""",
            organizationId).ToListAsync(cancellationToken);
    }

    public static async Task LockSuperAdminsAsync(this ClockedInDbContext db, CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(hashtext('superadmin'))", cancellationToken);
    }

    private static ApiException? Translate(PostgresException postgres)
    {
        var name = postgres.ConstraintName ?? "";
        if (postgres.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            if (name.Contains("pending", StringComparison.OrdinalIgnoreCase))
            {
                return ApiException.Conflict("A pending invite already exists for that email.");
            }

            if (name.Contains("sourceRef", StringComparison.OrdinalIgnoreCase))
            {
                return ApiException.Conflict("That sourceRef is already in use.");
            }

            if (name.Contains("username", StringComparison.OrdinalIgnoreCase))
            {
                return ApiException.Conflict("That username is already in use.");
            }

            if (name.Contains("email", StringComparison.OrdinalIgnoreCase)
                && !name.Contains("Invitation", StringComparison.Ordinal))
            {
                return ApiException.Conflict("That email is already in use.");
            }

            return ApiException.Conflict("That value is already in use.");
        }

        var timeConstraint = name.Contains("TimeEntry", StringComparison.Ordinal);
        if (postgres.SqlState == PostgresErrorCodes.ForeignKeyViolation)
        {
            return ApiException.Conflict(timeConstraint ? "Delete the time entries first." : "This record is still in use.");
        }

        if (postgres.SqlState == PostgresErrorCodes.CheckViolation)
        {
            return ApiException.Validation(timeConstraint
                ? "The time entry does not satisfy the time rules."
                : "The values do not satisfy the rules.");
        }

        return null;
    }
}
