using System.ComponentModel;
using ClockedIn.Api.Features.Collective;
using ClockedIn.Api.Features.TimeEntries;
using ClockedIn.Api.Http;
using ModelContextProtocol.Server;

namespace ClockedIn.Api.Mcp;

[McpServerToolType]
public sealed class TimeTools(TimeEntriesService timeEntries, CollectiveService collective)
{
    [McpServerTool, Description("List a user's time entries. Optional organizationId, departmentId, from, to, limit, offset.")]
    public Task<ListResponse<TimeEntryDto>> ListTimeEntries(
        Guid userId,
        string? organizationId,
        string? departmentId,
        string? from,
        string? to,
        int? limit,
        int? offset,
        CancellationToken cancellationToken) =>
        McpCall.Run(() => timeEntries.List(userId, new TimeEntryFilter(limit?.ToString(), offset?.ToString(), organizationId, departmentId, from, to), cancellationToken));

    [McpServerTool, Description("Get a time entry by id.")]
    public Task<TimeEntryDto> GetTimeEntry(Guid timeEntryId, CancellationToken cancellationToken) =>
        McpCall.Run(() => timeEntries.Get(timeEntryId, cancellationToken));

    [McpServerTool, Description("Create a time entry for a user. Pass JSON with mode (Punch, Duration, Total), organizationId, projectId, taskCategoryId, and time fields.")]
    public Task<TimeEntryDto> CreateTimeEntry(Guid userId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => timeEntries.Create(userId, CreateTimeEntryRequest.Parse(McpCall.Object(body), null), cancellationToken));

    [McpServerTool, Description("Update a time entry. Pass JSON with any writable fields.")]
    public Task<TimeEntryDto> UpdateTimeEntry(Guid timeEntryId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => timeEntries.Update(timeEntryId, UpdateTimeEntryRequest.Parse(McpCall.Object(body)), cancellationToken));

    [McpServerTool, Description("Delete a time entry.")]
    public Task<string> DeleteTimeEntry(Guid timeEntryId, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            await timeEntries.Delete(timeEntryId, cancellationToken);
            return "deleted";
        });

    [McpServerTool, Description("Clock in a user. userId is required for organization API keys. Pass JSON with organizationId, projectId, taskCategoryId, optional departmentId, tagIds, hourlyRateId.")]
    public Task<TimeEntryDto> ClockIn(Guid userId, string body, CancellationToken cancellationToken)
    {
        var json = McpCall.Object(body);
        json["userId"] = userId;
        return McpCall.Run(async () =>
        {
            var hourlyRateId = json.ContainsKey("hourlyRateId") ? Fields.OptionalGuid(json, "hourlyRateId") : null;
            return await timeEntries.ClockIn(new ClockInRequest(EntryPlacement.Parse(json), hourlyRateId, userId), cancellationToken);
        });
    }

    [McpServerTool, Description("Clock out a user. userId is required for organization API keys.")]
    public Task<TimeEntryDto> ClockOut(Guid userId, string? description, Guid[]? tagIds, CancellationToken cancellationToken) =>
        McpCall.Run(() => timeEntries.ClockOut(
            new ClockOutRequest(
                description is null ? default : new Optional<string?>(description),
                tagIds is null ? default : new Optional<List<Guid>>(tagIds.ToList()),
                default,
                default,
                default,
                userId),
            cancellationToken));

    [McpServerTool, Description("List collective time entries. Optional organizationId, departmentId, limit, offset.")]
    public Task<ListResponse<CollectiveEntryDto>> ListCollectiveEntries(
        string? organizationId,
        string? departmentId,
        int? limit,
        int? offset,
        CancellationToken cancellationToken) =>
        McpCall.Run(() => collective.List(new CollectiveFilter(limit?.ToString(), offset?.ToString(), organizationId, departmentId), cancellationToken));

    [McpServerTool, Description("Get a collective time entry.")]
    public Task<CollectiveEntryDto> GetCollectiveEntry(Guid collectiveEntryId, CancellationToken cancellationToken) =>
        McpCall.Run(() => collective.Get(collectiveEntryId, cancellationToken));

    [McpServerTool, Description("Create a collective time entry. Pass JSON with organizationId, projectId, taskCategoryId, startedAt, endedAt, participantCount.")]
    public Task<CollectiveEntryDto> CreateCollectiveEntry(string body, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            var json = McpCall.Object(body);
            var request = new CreateCollectiveRequest(
                Fields.RequiredGuid(json, "organizationId"),
                Fields.OptionalGuid(json, "departmentId"),
                Fields.RequiredGuid(json, "projectId"),
                Fields.RequiredGuid(json, "taskCategoryId"),
                Fields.RequiredInstant(json, "startedAt"),
                Fields.RequiredInstant(json, "endedAt"),
                Fields.RequiredInt(json, "participantCount"),
                Fields.OptionalDescription(json),
                Fields.Ids(json, "tagIds", optional: true),
                json.ContainsKey("hourlyRateId") ? Fields.OptionalGuid(json, "hourlyRateId") : null);
            CollectiveRules.AssertSpan(request.StartedAt, request.EndedAt, request.ParticipantCount);
            return await collective.Create(request, cancellationToken);
        });

    [McpServerTool, Description("Update a collective time entry.")]
    public Task<CollectiveEntryDto> UpdateCollectiveEntry(Guid collectiveEntryId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            var json = McpCall.Object(body);
            return await collective.Update(collectiveEntryId, new UpdateCollectiveRequest(
                Optional.Read(json, "organizationId", Fields.RequiredGuid),
                Optional.Read(json, "departmentId", Fields.OptionalGuid),
                Optional.Read(json, "projectId", Fields.RequiredGuid),
                Optional.Read(json, "taskCategoryId", Fields.RequiredGuid),
                Optional.Read(json, "hourlyRateId", Fields.OptionalGuid),
                Optional.Read(json, "startedAt", Fields.RequiredInstant),
                Optional.Read(json, "endedAt", Fields.RequiredInstant),
                Optional.Read(json, "participantCount", Fields.RequiredInt),
                Optional.Read(json, "description", (b, k) => Fields.Description(Fields.OptionalString(b, k))),
                Optional.Read(json, "tagIds", (b, k) => Fields.Ids(b, k, optional: false))), cancellationToken);
        });

    [McpServerTool, Description("Delete a collective time entry.")]
    public Task<string> DeleteCollectiveEntry(Guid collectiveEntryId, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            await collective.Delete(collectiveEntryId, cancellationToken);
            return "deleted";
        });
}
