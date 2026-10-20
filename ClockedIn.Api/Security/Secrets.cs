using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ClockedIn.Api.Configuration;
using ClockedIn.Api.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace ClockedIn.Api.Security;

public static class Passwords
{
    private static readonly Lazy<string> DummyHash = new(() => Hash("clocked-in-dummy-password"));

    public static string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);

    public static bool Verify(string password, string passwordHash) =>
        BCrypt.Net.BCrypt.Verify(password, passwordHash);

    public static void VerifyDummy(string password) => Verify(password, DummyHash.Value);
}

public static class Codes
{
    public static readonly TimeSpan AccessLifetime = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan RefreshLifetime = TimeSpan.FromDays(30);
    public static readonly TimeSpan RefreshReuse = TimeSpan.FromMinutes(2);
    public static readonly TimeSpan ResetLifetime = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan ResetCooldown = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan InviteLifetime = TimeSpan.FromDays(7);

    public static string RandomCode() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));

    public static string NumericCode() => RandomNumberGenerator.GetInt32(1_000_000).ToString("D6");

    public static async Task<string> AllocateNumericCode(
        Func<string, CancellationToken, Task<bool>> isTaken,
        CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 8; attempt++)
        {
            var code = NumericCode();
            if (!await isTaken(Hash(code), cancellationToken))
            {
                return code;
            }
        }

        throw new InvalidOperationException("Could not allocate a one-time code.");
    }

    public static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}

public sealed class TokenIssuer(IOptions<JwtOptions> options, TimeProvider time)
{
    private readonly JwtOptions _options = options.Value;

    public static TokenValidationParameters ValidationParameters(JwtOptions options) => new()
    {
        ValidateIssuer = true,
        ValidIssuer = options.Issuer,
        ValidateAudience = true,
        ValidAudience = options.Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = SigningKey(options),
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero,
    };

    public (string AccessToken, DateTime ExpiresAt) Sign(User user)
    {
        var expiresAt = time.GetUtcNow().UtcDateTime.Add(Codes.AccessLifetime);
        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("username", user.Username),
                new Claim("isSuperAdmin", user.IsSuperAdmin ? "true" : "false"),
            ],
            expires: expiresAt,
            signingCredentials: new SigningCredentials(SigningKey(_options), SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    private static SymmetricSecurityKey SigningKey(JwtOptions options) =>
        new(Encoding.UTF8.GetBytes(options.SigningKey));
}
