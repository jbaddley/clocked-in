using System.Net.Http;
using ClockedIn.Api.Security;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace ClockedIn.Api.OpenApi;

internal sealed class OpenApiDocumentFixes : IOpenApiDocumentTransformer
{
    public Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken cancellationToken)
    {
        document.Servers = [new OpenApiServer { Url = "/" }];
        document.Tags = OpenApiTags.All.Select(name => new OpenApiTag { Name = name }).ToHashSet();
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes["bearerAuth"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
        };
        document.Components.SecuritySchemes["apiKeyAuth"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.ApiKey,
            In = ParameterLocation.Header,
            Name = ApiKeyAuthenticationHandler.HeaderName,
        };

        RemoveOptionalSchemas(document);
        EnsureHealth(document);
        return Task.CompletedTask;
    }

    private static void RemoveOptionalSchemas(OpenApiDocument document)
    {
        var schemas = document.Components?.Schemas;
        if (schemas is null)
        {
            return;
        }

        foreach (var name in schemas.Keys.Where(key => key.StartsWith("Optional", StringComparison.Ordinal)).ToArray())
        {
            schemas.Remove(name);
        }
    }

    private static void EnsureHealth(OpenApiDocument document)
    {
        document.Paths ??= [];
        if (document.Paths.ContainsKey("/health"))
        {
            return;
        }

        var operation = new OpenApiOperation
        {
            OperationId = "get_health",
            Tags = new HashSet<OpenApiTagReference> { new("Health") },
            Responses = new OpenApiResponses
            {
                ["200"] = OpenApiJson.Response("OK", OpenApiJson.Object(
                    ("status", new OpenApiSchema { Type = JsonSchemaType.String }))),
            },
        };
        document.Paths["/health"] = new OpenApiPathItem
        {
            Operations = new Dictionary<HttpMethod, OpenApiOperation>
            {
                [HttpMethod.Get] = operation,
            },
        };
    }
}
