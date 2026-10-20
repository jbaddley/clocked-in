using System.Text.Json.Nodes;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Mcp;

internal static class McpCall
{
    public static async Task<T> Run<T>(Func<Task<T>> work)
    {
        try
        {
            return await work();
        }
        catch (ApiException exception)
        {
            throw new InvalidOperationException($"{exception.Code}: {exception.Message}");
        }
    }

    public static JsonObject Object(string json, string name = "body")
    {
        try
        {
            if (JsonNode.Parse(json) is JsonObject body)
            {
                return body;
            }
        }
        catch (System.Text.Json.JsonException)
        {
        }

        throw new InvalidOperationException($"validation_error: {name} must be a JSON object.");
    }
}
