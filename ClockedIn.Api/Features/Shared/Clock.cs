namespace ClockedIn.Api.Features.Shared;

public static class Clock
{
    public static DateTime UtcNow(this TimeProvider time) => time.GetUtcNow().UtcDateTime;

    public static DateTime UtcNowToSecond(this TimeProvider time)
    {
        var now = time.UtcNow();
        return new DateTime(now.Ticks - now.Ticks % TimeSpan.TicksPerSecond, DateTimeKind.Utc);
    }
}
