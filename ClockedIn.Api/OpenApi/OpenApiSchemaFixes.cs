using System.Text.Json.Nodes;
using ClockedIn.Api.Features.Imports;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace ClockedIn.Api.OpenApi;

internal sealed class OpenApiSchemaFixes : IOpenApiSchemaTransformer
{
    public async Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        var type = Unwrap(context.JsonTypeInfo.Type);
        if (IsOptional(context.JsonTypeInfo.Type))
        {
            var inner = await context.GetOrCreateSchemaAsync(type, cancellationToken: cancellationToken);
            Copy(inner, schema);
            DropOptionalRequired(schema, context);
            return;
        }

        if (context.JsonTypeInfo.Type == typeof(ImportRequest))
        {
            schema.Type = JsonSchemaType.Object;
            schema.Properties = new Dictionary<string, IOpenApiSchema>
            {
                ["rows"] = new OpenApiSchema
                {
                    Type = JsonSchemaType.Array,
                    Items = new OpenApiSchema { Type = JsonSchemaType.Object },
                },
            };
            schema.Required = new HashSet<string> { "rows" };
            schema.AdditionalProperties = null;
            return;
        }

        if (type.IsEnum)
        {
            schema.Type = JsonSchemaType.String;
            schema.Format = null;
            schema.Enum = Enum.GetNames(type).Select(name => (JsonNode)JsonValue.Create(name)!).ToList();
        }
        else if (type == typeof(DateTime))
        {
            schema.Type = JsonSchemaType.String;
            schema.Format = "date-time";
            schema.Pattern = null;
        }
        else if (type == typeof(DateOnly))
        {
            schema.Type = JsonSchemaType.String;
            schema.Format = "date";
        }
        else if (type == typeof(decimal))
        {
            schema.Type = JsonSchemaType.Number;
            schema.Format = "decimal";
            schema.Pattern = null;
        }

        if (IsNullable(context))
        {
            schema.Type |= JsonSchemaType.Null;
        }

        DropOptionalRequired(schema, context);
        await ReplaceOptionalProperties(schema, context, cancellationToken);
    }

    private static async Task ReplaceOptionalProperties(
        OpenApiSchema schema,
        OpenApiSchemaTransformerContext context,
        CancellationToken cancellationToken)
    {
        if (schema.Properties is null)
        {
            return;
        }

        foreach (var property in context.JsonTypeInfo.Properties)
        {
            if (!IsOptional(property.PropertyType) || !schema.Properties.ContainsKey(property.Name))
            {
                continue;
            }

            var inner = Unwrap(property.PropertyType);
            schema.Properties[property.Name] = await context.GetOrCreateSchemaAsync(inner, cancellationToken: cancellationToken);
            schema.Required?.Remove(property.Name);
        }
    }

    private static void DropOptionalRequired(OpenApiSchema schema, OpenApiSchemaTransformerContext context)
    {
        if (schema.Required is null || schema.Required.Count == 0)
        {
            return;
        }

        foreach (var property in context.JsonTypeInfo.Properties)
        {
            if (IsOptional(property.PropertyType) || property.IsGetNullable)
            {
                schema.Required.Remove(property.Name);
            }
        }
    }

    private static bool IsNullable(OpenApiSchemaTransformerContext context) =>
        context.JsonPropertyInfo?.IsGetNullable == true
        || Nullable.GetUnderlyingType(context.JsonTypeInfo.Type) is not null;

    private static bool IsOptional(Type type) =>
        type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Optional<>);

    private static Type Unwrap(Type type)
    {
        if (IsOptional(type))
        {
            return type.GetGenericArguments()[0];
        }

        return Nullable.GetUnderlyingType(type) ?? type;
    }

    private static void Copy(OpenApiSchema source, OpenApiSchema target)
    {
        target.Type = source.Type;
        target.Format = source.Format;
        target.Pattern = source.Pattern;
        target.Properties = source.Properties;
        target.Items = source.Items;
        target.Required = source.Required;
        target.OneOf = source.OneOf;
        target.AnyOf = source.AnyOf;
        target.AllOf = source.AllOf;
        target.Enum = source.Enum;
        target.AdditionalProperties = source.AdditionalProperties;
        target.Description = source.Description;
    }
}
