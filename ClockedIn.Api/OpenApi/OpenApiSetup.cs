using Microsoft.AspNetCore.OpenApi;

namespace ClockedIn.Api.OpenApi;

public static class OpenApiSetup
{
    public static OpenApiOptions AddClockedInOpenApi(this OpenApiOptions options)
    {
        options.AddSchemaTransformer<OpenApiSchemaFixes>();
        options.AddOperationTransformer<OpenApiOperations>();
        options.AddDocumentTransformer<OpenApiDocumentFixes>();
        return options;
    }
}
