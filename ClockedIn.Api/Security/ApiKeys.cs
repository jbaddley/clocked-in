using System.Security.Cryptography;
using System.Text;
using ClockedIn.Api.Configuration;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace ClockedIn.Api.Security;

public sealed class ApiKeyHasher
{
    public const string LivePrefix = "cki_live_";
    public const string TestPrefix = "cki_test_";

    private readonly byte[] _pepper;
    private readonly string _dummyHash;

    public ApiKeyHasher(IOptions<ApiKeyOptions> options)
    {
        _pepper = Encoding.UTF8.GetBytes(options.Value.Pepper);
        _dummyHash = Hash("clocked-in-dummy-api-key");
    }

    public static bool LooksLike(string value) =>
        value.StartsWith(LivePrefix, StringComparison.Ordinal) || value.StartsWith(TestPrefix, StringComparison.Ordinal);

    public (string Prefix, string Secret) Issue(string environment)
    {
        var kind = environment is "Production" or "Staging" ? LivePrefix : TestPrefix;
        var prefix = kind + Convert.ToHexString(RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
        var secret = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        return (prefix, secret);
    }

    public static string Combine(string prefix, string secret) => $"{prefix}_{secret}";

    public static string? PrefixOf(string key)
    {
        if (!LooksLike(key))
        {
            return null;
        }

        var kindLength = key.StartsWith(LivePrefix, StringComparison.Ordinal) ? LivePrefix.Length : TestPrefix.Length;
        var separator = kindLength + 8;
        if (key.Length <= separator + 1 || key[separator] != '_')
        {
            return null;
        }

        return key[..separator];
    }

    public string Hash(string key)
    {
        using var hmac = new HMACSHA256(_pepper);
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(key))).ToLowerInvariant();
    }

    public bool Matches(string key, string keyHash) => CryptographicOperations.FixedTimeEquals(
        Encoding.UTF8.GetBytes(Hash(key)),
        Encoding.UTF8.GetBytes(keyHash));

    public void VerifyDummy(string key) => Matches(key, _dummyHash);
}
