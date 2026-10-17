using ClockedIn.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;
using Npgsql.NameTranslation;

namespace ClockedIn.Api.Data;

public static class EfConnection
{
    public const string EnvironmentVariable = "EF_DATABASE_URL";

    public static void LoadEnvFile()
    {
        var fileName = EnvFileName();
        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            var dir = new DirectoryInfo(start);
            while (dir is not null)
            {
                var path = Path.Combine(dir.FullName, fileName);
                if (File.Exists(path))
                {
                    ApplyEnvFile(path);
                    return;
                }

                dir = dir.Parent;
            }
        }
    }

    private static string EnvFileName() =>
        Environment.GetEnvironmentVariable("APP_ENV") switch
        {
            "production" => ".env.production",
            "staging" => ".env.staging",
            _ => ".env",
        };

    public static string GetConnectionString()
    {
        var connectionString = Environment.GetEnvironmentVariable(EnvironmentVariable);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException($"{EnvironmentVariable} is not set.");
        }

        return Normalize(connectionString);
    }

    public static string Normalize(string connectionString) =>
        ToNpgsqlConnectionString(StripPrismaSchemaParameter(connectionString));

    private static readonly NpgsqlNullNameTranslator EnumNames = new();

    public const string MigrationsHistorySchema = "ef";

    public static void MapEnums(NpgsqlDbContextOptionsBuilder npgsql)
    {
        npgsql.MigrationsHistoryTable("__EFMigrationsHistory", MigrationsHistorySchema);
        npgsql.MapEnum<TimeEntryMode>("TimeEntryMode", nameTranslator: EnumNames);
    }

    private static void ApplyEnvFile(string path)
    {
        foreach (var raw in File.ReadAllLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }

            var separator = line.IndexOf('=');
            if (separator <= 0)
            {
                continue;
            }

            var key = line[..separator].Trim();
            var value = line[(separator + 1)..].Trim();
            if (value.Length >= 2 && value[0] == '"' && value[^1] == '"')
            {
                value = value[1..^1];
            }

            if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
            {
                Environment.SetEnvironmentVariable(key, value);
            }
        }
    }

    private static string ToNpgsqlConnectionString(string connectionString)
    {
        if (connectionString.StartsWith("sqlserver://", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "EF_DATABASE_URL is a SQL Server URL. This API host uses PostgreSQL. Production SQL Server is served by the deployed C# API (API_TARGET=csharp).");
        }

        if (!connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return connectionString;
        }

        var uri = new Uri(connectionString);
        var userInfo = uri.UserInfo.Split(':', 2);
        var username = Uri.UnescapeDataString(userInfo[0]);
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var database = uri.AbsolutePath.TrimStart('/');
        return $"Host={uri.Host};Port={uri.Port};Database={database};Username={username};Password={password}";
    }

    private static string StripPrismaSchemaParameter(string connectionString)
    {
        var question = connectionString.IndexOf('?');
        if (question < 0)
        {
            return connectionString;
        }

        var kept = connectionString[(question + 1)..]
            .Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Where(part => !part.StartsWith("schema=", StringComparison.OrdinalIgnoreCase))
            .ToArray();

        return kept.Length == 0
            ? connectionString[..question]
            : $"{connectionString[..question]}?{string.Join('&', kept)}";
    }
}
