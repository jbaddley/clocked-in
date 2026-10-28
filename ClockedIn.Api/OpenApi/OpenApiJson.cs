using Microsoft.OpenApi;

namespace ClockedIn.Api.OpenApi;

internal static class OpenApiJson
{
    public static OpenApiMediaType Media(IOpenApiSchema schema) => new()
    {
        Schema = schema,
    };

    public static OpenApiRequestBody Body(IOpenApiSchema schema) => new()
    {
        Required = true,
        Content = new Dictionary<string, OpenApiMediaType>
        {
            ["application/json"] = Media(schema),
        },
    };

    public static OpenApiResponse Response(string description, IOpenApiSchema? schema = null, string contentType = "application/json")
    {
        var response = new OpenApiResponse { Description = description };
        if (schema is null)
        {
            return response;
        }

        response.Content = new Dictionary<string, OpenApiMediaType>
        {
            [contentType] = Media(schema),
        };
        return response;
    }

    public static OpenApiSchema Object(params (string Name, IOpenApiSchema Schema)[] properties)
    {
        var schema = new OpenApiSchema
        {
            Type = JsonSchemaType.Object,
            Properties = new Dictionary<string, IOpenApiSchema>(),
            Required = new HashSet<string>(),
        };
        foreach (var (name, property) in properties)
        {
            schema.Properties[name] = property;
            schema.Required.Add(name);
        }

        return schema;
    }
}
