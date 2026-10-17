namespace ClockedIn.Api.Http;

public sealed record ListResponse<T>(IReadOnlyList<T> Items, int Limit, int Offset);

public sealed record ErrorResponse(string Code, string Message);

public sealed record OkResponse(bool Ok)
{
    public static readonly OkResponse Instance = new(true);
}

public static class ListResponse
{
    public static ListResponse<T> Of<T>(IReadOnlyList<T> items, Page page) => new(items, page.Limit, page.Offset);
}
