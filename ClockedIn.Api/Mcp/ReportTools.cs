using System.ComponentModel;
using System.Text;
using ClockedIn.Api.Features.Reports;
using ClockedIn.Api.Http;
using ModelContextProtocol.Server;

namespace ClockedIn.Api.Mcp;

[McpServerToolType]
public sealed class ReportTools(ReportsService reports)
{
    [McpServerTool, Description("Get volunteer and collective report aggregates for an organization. Optional departmentId, taskCategoryId, projectId, userId, from, to.")]
    public Task<ReportDto> GetReport(
        Guid organizationId,
        string? departmentId,
        string? taskCategoryId,
        string? projectId,
        string? userId,
        string? from,
        string? to,
        CancellationToken cancellationToken) =>
        McpCall.Run(() => reports.Report(
            organizationId,
            Filter(departmentId, taskCategoryId, projectId, userId, from, to),
            cancellationToken));

    [McpServerTool, Description("Export time-entry CSV for an organization. Same optional filters as get_report.")]
    public Task<string> ExportTimeEntriesCsv(
        Guid organizationId,
        string? departmentId,
        string? taskCategoryId,
        string? projectId,
        string? userId,
        string? from,
        string? to,
        CancellationToken cancellationToken) =>
        McpCall.Run(async () => await ReadCsv(await reports.Csv(
            organizationId,
            Filter(departmentId, taskCategoryId, projectId, userId, from, to),
            cancellationToken)));

    [McpServerTool, Description("Export the summary CSV for an organization. Same optional filters as get_report.")]
    public Task<string> ExportSummaryCsv(
        Guid organizationId,
        string? departmentId,
        string? taskCategoryId,
        string? projectId,
        string? userId,
        string? from,
        string? to,
        CancellationToken cancellationToken) =>
        McpCall.Run(async () => await ReadCsv(await reports.SummaryCsv(
            organizationId,
            Filter(departmentId, taskCategoryId, projectId, userId, from, to),
            cancellationToken)));

    private static ReportFilter Filter(
        string? departmentId,
        string? taskCategoryId,
        string? projectId,
        string? userId,
        string? from,
        string? to) =>
        new(departmentId, taskCategoryId, projectId, userId, from, to);

    private static async Task<string> ReadCsv(IResult result)
    {
        var context = new DefaultHttpContext { Response = { Body = new MemoryStream() } };
        await result.ExecuteAsync(context);
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body, Encoding.UTF8);
        return await reader.ReadToEndAsync();
    }
}
