using ClockedIn.Api.Configuration;
using ClockedIn.Api.Data;
using ClockedIn.Api.Email;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features;
using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Npgsql;
using Npgsql.NameTranslation;

EfConnection.LoadEnvFile();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddClockedInOptions();
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
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddClockedInFeatures();
builder.Services.AddHealthChecks().AddDbContextCheck<ClockedInDbContext>();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseExceptionHandler(new ExceptionHandlerOptions { ExceptionHandler = _ => Task.CompletedTask });
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = (context, report) => context.Response.WriteAsJsonAsync(new { status = report.Status == HealthStatus.Healthy ? "ok" : "unavailable" }),
}).WithMetadata(new HttpMethodMetadata(["GET"])).WithName("Health");
app.MapClockedInEndpoints();

app.Run();
