namespace ClockedIn.Api.Http;

public readonly record struct Page(int Limit, int Offset);

public sealed record PageQuery(string? Limit, string? Offset)
{
    public Page Resolve() => Fields.Page(Limit, Offset);
}

public sealed record TimeEntryFilter(
    string? Limit,
    string? Offset,
    string? OrganizationId,
    string? DepartmentId,
    string? From,
    string? To);

public sealed record CollectiveFilter(string? Limit, string? Offset, string? OrganizationId, string? DepartmentId);

public sealed record ReportFilter(
    string? DepartmentId,
    string? TaskCategoryId,
    string? ProjectId,
    string? UserId,
    string? From,
    string? To);

public sealed record FeedbackFilter(
    string? Limit,
    string? Offset,
    string? Active,
    string? Type,
    string? Priority,
    string? Area,
    string? Status,
    string? Sort,
    string? Order);
