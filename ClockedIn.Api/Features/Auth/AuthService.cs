using ClockedIn.Api.Configuration;
using ClockedIn.Api.Data;
using ClockedIn.Api.Email;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Features.Users;
using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ClockedIn.Api.Features.Auth;

public sealed class AuthService(
    ClockedInDbContext db,
    TokenIssuer tokens,
    IEmailSender mail,
    IOptions<EmailOptions> emailOptions,
    TimeProvider time)
{
    public async Task<SessionDto> SignUp(SignUpRequest request, CancellationToken cancellationToken)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            Email = request.Email,
            PasswordHash = Passwords.Hash(request.Password),
            Profile = new UserProfile
            {
                Id = Guid.NewGuid(),
                FirstName = request.FirstName,
                LastName = request.LastName,
                DisplayName = request.DisplayName,
                Timezone = request.Timezone,
                Phone = request.Phone,
            },
        };
        db.Users.Add(user);
        await db.SaveOrThrowAsync(cancellationToken);
        return await IssueSession(user, cancellationToken);
    }

    public async Task<SessionDto> LogIn(LogInRequest request, CancellationToken cancellationToken)
    {
        var user = await db.UsersWithProfile().FirstOrDefaultAsync(item => item.Username == request.Username, cancellationToken);
        if (user is null)
        {
            Passwords.VerifyDummy(request.Password);
        }

        if (user is null || !Passwords.Verify(request.Password, user.PasswordHash))
        {
            throw ApiException.Unauthorized("The username or password is incorrect.");
        }

        return await IssueSession(user, cancellationToken);
    }

    public async Task<SessionDto> Refresh(RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        var hash = Codes.Hash(request.RefreshToken);
        var now = time.UtcNow();
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var claimed = await db.RefreshTokens
            .Where(token => token.TokenHash == hash && token.RevokedAt == null && token.ExpiresAt > now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(token => token.RevokedAt, now), cancellationToken);
        if (claimed == 0)
        {
            var existing = await db.RefreshTokens.AsNoTracking()
                .FirstOrDefaultAsync(token => token.TokenHash == hash, cancellationToken);
            var reusable = existing is { RevokedAt: DateTime revokedAt }
                && existing.ExpiresAt > now
                && now - revokedAt <= Codes.RefreshReuse;
            if (!reusable)
            {
                throw ApiException.Unauthorized();
            }
        }

        var user = await db.UsersWithProfile().FirstAsync(item => item.RefreshTokens.Any(token => token.TokenHash == hash), cancellationToken);
        var session = await IssueSession(user, cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return session;
    }

    public async Task LogOut(Guid callerId, RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        var hash = Codes.Hash(request.RefreshToken);
        var now = time.UtcNow();
        await db.RefreshTokens
            .Where(token => token.TokenHash == hash && token.UserId == callerId && token.ExpiresAt > now)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(token => token.RevokedAt, now)
                    .SetProperty(token => token.ExpiresAt, now),
                cancellationToken);
    }

    public async Task RequestPasswordReset(string? emailValue, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(emailValue))
        {
            throw ApiException.Validation("email is required.");
        }

        string email;
        try
        {
            email = Fields.NormalizeEmail(emailValue);
        }
        catch (ApiException)
        {
            return;
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(item => item.Email == email, cancellationToken);
        if (user is null)
        {
            return;
        }

        var now = time.UtcNow();
        var latest = await db.PasswordResetCodes.AsNoTracking()
            .Where(code => code.UserId == user.Id)
            .OrderByDescending(code => code.CreatedAt)
            .Select(code => (DateTime?)code.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (latest is DateTime createdAt && now - createdAt < Codes.ResetCooldown)
        {
            return;
        }

        var code = await Codes.AllocateNumericCode(
            (hash, ct) => db.PasswordResetCodes.AnyAsync(item => item.CodeHash == hash, ct),
            cancellationToken);
        var created = new PasswordResetCode
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            CodeHash = Codes.Hash(code),
            ExpiresAt = now.Add(Codes.ResetLifetime),
            CreatedAt = now,
        };
        db.PasswordResetCodes.Add(created);
        await db.SaveOrThrowAsync(cancellationToken);
        try
        {
            await mail.Send(
                email,
                "password-reset",
                new Dictionary<string, string>
                {
                    ["code"] = code,
                    ["url"] = emailOptions.Value.Link($"/forgot-password?code={Uri.EscapeDataString(code)}"),
                },
                cancellationToken);
        }
        catch
        {
            db.PasswordResetCodes.Remove(created);
            await db.SaveChangesAsync(cancellationToken);
            throw;
        }

        await db.PasswordResetCodes
            .Where(item => item.UserId == user.Id && item.UsedAt == null && item.Id != created.Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.UsedAt, now), cancellationToken);
    }

    public async Task ConfirmPasswordReset(ConfirmPasswordResetRequest request, CancellationToken cancellationToken)
    {
        var now = time.UtcNow();
        var hash = Codes.Hash(request.Code);
        var user = await db.Users.FirstOrDefaultAsync(item => item.Email == request.Email, cancellationToken);
        var reset = user is null
            ? null
            : await db.PasswordResetCodes.FirstOrDefaultAsync(
                item => item.UserId == user.Id && item.CodeHash == hash && item.UsedAt == null && item.ExpiresAt > now,
                cancellationToken);
        if (user is null || reset is null)
        {
            throw ApiException.Validation("The code is not valid.");
        }

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        user.PasswordHash = Passwords.Hash(request.Password);
        user.MustChangePassword = false;
        reset.UsedAt = now;
        await db.RefreshTokens
            .Where(token => token.UserId == user.Id && token.ExpiresAt > now)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(token => token.RevokedAt, now)
                    .SetProperty(token => token.ExpiresAt, now),
                cancellationToken);
        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
    }

    private async Task<SessionDto> IssueSession(User user, CancellationToken cancellationToken)
    {
        var (accessToken, expiresAt) = tokens.Sign(user);
        var refreshToken = Codes.RandomCode();
        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = Codes.Hash(refreshToken),
            ExpiresAt = time.UtcNow().Add(Codes.RefreshLifetime),
        });
        await db.SaveOrThrowAsync(cancellationToken);
        return new SessionDto(accessToken, refreshToken, expiresAt, UserDto.From(user));
    }
}
