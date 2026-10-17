using System.Text.Json.Nodes;

namespace ClockedIn.Api.Http;

public static class Body
{
    public static async Task<JsonObject> Read(HttpContext context)
    {
        using var reader = new StreamReader(context.Request.Body);
        var text = await reader.ReadToEndAsync(context.RequestAborted);
        if (string.IsNullOrWhiteSpace(text))
        {
            return [];
        }

        try
        {
            if (JsonNode.Parse(text) is not JsonObject body)
            {
                throw ApiException.Validation("Request body must be JSON.");
            }

            return body;
        }
        catch (System.Text.Json.JsonException)
        {
            throw ApiException.Validation("Request body must be JSON.");
        }
    }
}
