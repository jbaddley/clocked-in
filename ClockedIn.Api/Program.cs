using System.Net.Http.Headers;
using ClockedIn.Api.Configuration;
using ClockedIn.Api.Data;
using ClockedIn.Api.Email;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features;
using ClockedIn.Api.GitHub;
using ClockedIn.Api.Http;
using ClockedIn.Api.OpenApi;
using ClockedIn.Api.Security;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using ModelContextProtocol.AspNetCore;
using Npgsql;
using Npgsql.NameTranslation;

EfConnection.LoadEnvFile();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddClockedInOptions();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new UtcDateTimeJsonConverter()));
if (!string.IsNullOrWhiteSpace(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]))
{
    builder.Services.AddApplicationInsightsTelemetry();
}
builder.Services.AddSingleton(services =>
{
    var dataSource = new NpgsqlDataSourceBuilder(services.GetRequiredService<IOptions<DatabaseOptions>>().Value.ConnectionString);
    dataSource.MapEnum<TimeEntryMode>("TimeEntryMode", new NpgsqlNullNameTranslator());
    return dataSource.Build();
});
builder.Services.AddDbContext<ClockedInDbContext>((services, options) =>
    options.UseNpgsql(services.GetRequiredService<NpgsqlDataSource>(), EfConnection.MapEnums));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddClockedInAuthentication();
builder.Services.AddHttpClient<IEmailSender, ResendEmailSender>();
builder.Services.AddHttpClient<TurnstileVerifier>();
builder.Services.AddHttpClient<IGithubIssues, GithubIssuesClient>((services, http) =>
{
    var github = services.GetRequiredService<IOptions<GithubOptions>>().Value;
    http.BaseAddress = new Uri($"{github.Url.TrimEnd('/')}/");
    http.DefaultRequestHeaders.UserAgent.ParseAdd("clocked-in");
    http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
    http.DefaultRequestHeaders.TryAddWithoutValidation("X-GitHub-Api-Version", "2022-11-28");
    if (!string.IsNullOrWhiteSpace(github.Token))
    {
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", github.Token);
    }
});
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddClockedInFeatures();
builder.Services.AddHealthChecks().AddDbContextCheck<ClockedInDbContext>();
builder.Services.AddOpenApi(options => options.AddClockedInOpenApi());
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("Mcp-Session-Id", "MCP-Session-Id");
        var origins = CorsOrigins.From(builder.Configuration);
        if (origins.Length == 0)
        {
            policy.AllowAnyOrigin();
            return;
        }

        policy.WithOrigins(origins);
    });
});
builder.Services.AddMcpServer()
    .WithHttpTransport(options => options.SessionMode = HttpServerSessionMode.Stateless)
    .WithToolsFromAssembly();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseForwardedHeaders();
app.UseCors();
app.UseHttpsRedirection();
app.UseExceptionHandler(new ExceptionHandlerOptions { ExceptionHandler = _ => Task.CompletedTask });
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<RequirePasswordChangeMiddleware>();

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = (context, report) => context.Response.WriteAsJsonAsync(new { status = report.Status == HealthStatus.Healthy ? "ok" : "unavailable" }),
}).WithMetadata(new HttpMethodMetadata(["GET"])).WithName("Health");
app.MapClockedInEndpoints();
app.MapMcp("/mcp").RequireAuthorization().ExcludeFromDescription();

app.Run();
