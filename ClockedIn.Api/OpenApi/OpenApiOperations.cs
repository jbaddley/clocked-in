using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using ClockedIn.Api.Features.Feedback;
using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace ClockedIn.Api.OpenApi;

internal sealed class OpenApiOperations : IOpenApiOperationTransformer
{
    private static readonly Regex RouteConstraint = new(@"\{([^}:]+)(?::[^}]+)?\}", RegexOptions.Compiled);
    public async Task TransformAsync(OpenApiOperation operation, OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        var path = PathOf(context);
        var method = (context.Description.HttpMethod ?? "GET").ToUpperInvariant();
        operation.Tags = new HashSet<OpenApiTagReference> { new(OpenApiTags.For(path)) };
        operation.OperationId = OperationId(method, path);
        CamelCaseQueryNames(operation);

        operation.Responses ??= new OpenApiResponses();
        if (path.EndsWith(".csv", StringComparison.Ordinal))
        {
            operation.Responses["200"] = OpenApiJson.Response("OK", new OpenApiSchema { Type = JsonSchemaType.String }, "text/csv");
        }

        if (path == "/health")
        {
            operation.Responses["200"] = OpenApiJson.Response("OK", HealthSchema());
        }

        await AddRequestBody(operation, context, path, method, cancellationToken);
        await AddErrors(operation, context, path, method, cancellationToken);

        if (IsAuthorized(context))
        {
            operation.Security =
            [
                Requirement("bearerAuth", context.Document!),
                Requirement("apiKeyAuth", context.Document!),
            ];
        }
    }

    private static async Task AddRequestBody(
        OpenApiOperation operation,
        OpenApiOperationTransformerContext context,
        string path,
        string method,
        CancellationToken cancellationToken)
    {
        if (path == "/feedback/{id}" && method == "PATCH")
        {
            var edit = await context.GetOrCreateSchemaAsync(typeof(EditFeedbackRequest), cancellationToken: cancellationToken);
            var update = await context.GetOrCreateSchemaAsync(typeof(UpdateFeedbackRequest), cancellationToken: cancellationToken);
            operation.RequestBody = OpenApiJson.Body(new OpenApiSchema { OneOf = [edit, update] });
            return;
        }

        var bodyType = BodyType(context);
        if (bodyType is null)
        {
            return;
        }

        var schema = await context.GetOrCreateSchemaAsync(bodyType, cancellationToken: cancellationToken);
        operation.RequestBody = OpenApiJson.Body(schema);
    }

    private static async Task AddErrors(
        OpenApiOperation operation,
        OpenApiOperationTransformerContext context,
        string path,
        string method,
        CancellationToken cancellationToken)
    {
        var error = await context.GetOrCreateSchemaAsync(typeof(ErrorResponse), cancellationToken: cancellationToken);
        var responses = operation.Responses ??= new OpenApiResponses();
        var write = method is "POST" or "PUT" or "PATCH" or "DELETE";
        if (write)
        {
            responses.TryAdd("400", OpenApiJson.Response("Validation error", error));
        }

        if (IsAuthorized(context))
        {
            responses.TryAdd("401", OpenApiJson.Response("Unauthorized", error));
            responses.TryAdd("403", OpenApiJson.Response("Forbidden", error));
        }

        if (path.Contains('{', StringComparison.Ordinal))
        {
            responses.TryAdd("404", OpenApiJson.Response("Not found", error));
        }

        if (write)
        {
            responses.TryAdd("409", OpenApiJson.Response("Conflict", error));
        }
    }

    private static Type? BodyType(OpenApiOperationTransformerContext context)
    {
        var method = context.Description.ActionDescriptor.EndpointMetadata.OfType<MethodInfo>().FirstOrDefault();
        if (method is null)
        {
            return null;
        }

        var services = context.ApplicationServices.GetService<IServiceProviderIsService>();
        foreach (var parameter in method.GetParameters())
        {
            if (parameter.GetCustomAttribute<AsParametersAttribute>() is not null)
            {
                continue;
            }

            var type = parameter.ParameterType;
            if (type == typeof(HttpContext)
                || type == typeof(CancellationToken)
                || type == typeof(CurrentUser)
                || services?.IsService(type) == true)
            {
                continue;
            }

            if (HasBindAsync(type) || type == typeof(JsonElement))
            {
                return type;
            }
        }

        return null;
    }

    private static bool HasBindAsync(Type type) =>
        type.GetMethods(BindingFlags.Public | BindingFlags.Static)
            .Any(method => method.Name == "BindAsync");

    private static bool IsAuthorized(OpenApiOperationTransformerContext context)
    {
        var metadata = context.Description.ActionDescriptor.EndpointMetadata;
        return metadata.OfType<IAuthorizeData>().Any() && metadata.OfType<IAllowAnonymous>().All(_ => false);
    }

    private static void CamelCaseQueryNames(OpenApiOperation operation)
    {
        if (operation.Parameters is null)
        {
            return;
        }

        foreach (var parameter in operation.Parameters.OfType<OpenApiParameter>())
        {
            if (parameter.In == ParameterLocation.Query && parameter.Name is not null)
            {
                parameter.Name = JsonNamingPolicy.CamelCase.ConvertName(parameter.Name);
            }
        }
    }

    private static OpenApiSecurityRequirement Requirement(string scheme, OpenApiDocument document) =>
        new()
        {
            { new OpenApiSecuritySchemeReference(scheme, document), new List<string>() },
        };

    private static string PathOf(OpenApiOperationTransformerContext context)
    {
        var relative = RouteConstraint.Replace(context.Description.RelativePath ?? "", "{$1}");
        return "/" + relative.Trim('/');
    }

    private static string OperationId(string method, string path)
    {
        var suffix = path.Trim('/').Replace('/', '_').Replace("{", "", StringComparison.Ordinal).Replace("}", "", StringComparison.Ordinal);
        return string.IsNullOrEmpty(suffix) ? method.ToLowerInvariant() : $"{method.ToLowerInvariant()}_{suffix}";
    }

    private static OpenApiSchema HealthSchema() => OpenApiJson.Object(
        ("status", new OpenApiSchema { Type = JsonSchemaType.String }));
}
