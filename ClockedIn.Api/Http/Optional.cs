using System.Text.Json.Nodes;

namespace ClockedIn.Api.Http;

public readonly struct Optional<T>
{
    public Optional(T value)
    {
        HasValue = true;
        Value = value;
    }

    public bool HasValue { get; }

    public T Value { get; }

    public T Or(T fallback) => HasValue ? Value : fallback;
}

public static class Optional
{
    public static Optional<T> Read<T>(JsonObject body, string key, Func<JsonObject, string, T> read) =>
        Fields.Has(body, key) ? new Optional<T>(read(body, key)) : default;
}
