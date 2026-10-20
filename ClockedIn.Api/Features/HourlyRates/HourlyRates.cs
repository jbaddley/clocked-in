using System.Text.Json.Nodes;
using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.HourlyRates;

public sealed record HourlyRateDto(
    Guid Id,
    Guid OrganizationId,
    string Type,
    string Name,
    decimal PerHourRate,
    bool IsDefault,
    bool IsArchived,
    string? Source)
{
    public static HourlyRateDto From(HourlyRate rate) => new(
        rate.Id,
        rate.OrganizationId,
        rate.Type.ToString(),
        rate.Name,
        rate.PerHourRate,
        rate.IsDefault,
        rate.IsArchived,
        rate.Source);
}

public sealed record CreateHourlyRateRequest(
    RateType Type,
    string Name,
    decimal PerHourRate,
    bool IsDefault,
    bool IsArchived,
    string? Source)
{
    public static async ValueTask<CreateHourlyRateRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static CreateHourlyRateRequest Parse(JsonObject body)
    {
        var type = Fields.NormalizeRateType(Fields.RequiredString(body, "type"));
        var name = Fields.RequireName(Fields.RequiredString(body, "name"));
        var perHourRate = Fields.RoundMoney(Fields.RequiredDecimal(body, "perHourRate"));
        if (perHourRate <= 0)
        {
            throw ApiException.Validation("perHourRate must be greater than zero.");
        }

        var isDefault = Fields.Has(body, "isDefault") && Fields.RequiredBool(body, "isDefault");
        var isArchived = Fields.Has(body, "isArchived") && Fields.RequiredBool(body, "isArchived");
        if (isDefault && type != RateType.Volunteer)
        {
            throw ApiException.Validation("Only a volunteer rate can be the default.");
        }

        if (isDefault && isArchived)
        {
            throw ApiException.Validation("The default volunteer rate cannot be archived.");
        }

        return new CreateHourlyRateRequest(type, name, perHourRate, isDefault, isArchived, ReadSource(body));
    }

    internal static string? ReadSource(JsonObject body)
    {
        if (!Fields.Has(body, "source") || body["source"] is null)
        {
            return null;
        }

        var value = (Fields.OptionalString(body, "source") ?? "").Trim();
        if (value.Length == 0)
        {
            return null;
        }

        if (value.Length > 200)
        {
            throw ApiException.Validation("source must be 200 characters or fewer.");
        }

        return value;
    }
}

public sealed record UpdateHourlyRateRequest(
    Optional<RateType> Type,
    Optional<string> Name,
    Optional<decimal> PerHourRate,
    Optional<bool> IsDefault,
    Optional<bool> IsArchived,
    Optional<string?> Source)
{
    public static async ValueTask<UpdateHourlyRateRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static UpdateHourlyRateRequest Parse(JsonObject body)
    {
        var request = new UpdateHourlyRateRequest(
            Optional.Read(body, "type", (b, k) => Fields.NormalizeRateType(Fields.RequiredString(b, k))),
            Optional.Read(body, "name", (b, k) => Fields.RequireName(Fields.RequiredString(b, k))),
            Optional.Read(body, "perHourRate", (b, k) =>
            {
                var rate = Fields.RoundMoney(Fields.RequiredDecimal(b, k));
                if (rate <= 0)
                {
                    throw ApiException.Validation("perHourRate must be greater than zero.");
                }

                return rate;
            }),
            Optional.Read(body, "isDefault", Fields.RequiredBool),
            Optional.Read(body, "isArchived", Fields.RequiredBool),
            Optional.Read(body, "source", (b, _) => CreateHourlyRateRequest.ReadSource(b)));
        if (!request.Type.HasValue
            && !request.Name.HasValue
            && !request.PerHourRate.HasValue
            && !request.IsDefault.HasValue
            && !request.IsArchived.HasValue
            && !request.Source.HasValue)
        {
            throw ApiException.Validation("Provide at least one field to update.");
        }

        return request;
    }
}

public sealed class HourlyRatesService(ClockedInDbContext db, Access access)
{
    public static HourlyRate SeedDefault(Guid organizationId) => new()
    {
        Id = Guid.NewGuid(),
        OrganizationId = organizationId,
        Type = RateType.Volunteer,
        Name = "Volunteer",
        PerHourRate = 35.47m,
        IsDefault = true,
        IsArchived = false,
    };

    public async Task<ListResponse<HourlyRateDto>> List(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var rates = await db.HourlyRates.AsNoTracking()
            .Where(rate => rate.OrganizationId == organizationId)
            .OrderByDescending(rate => rate.IsDefault)
            .ThenBy(rate => rate.Type)
            .ThenBy(rate => rate.Name)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(rates.Select(HourlyRateDto.From).ToList(), page);
    }

    public async Task<HourlyRateDto> Create(Guid organizationId, CreateHourlyRateRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        if (request.IsDefault)
        {
            await ClearDefault(organizationId, null, cancellationToken);
        }

        var rate = new HourlyRate
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            Type = request.Type,
            Name = request.Name,
            PerHourRate = request.PerHourRate,
            IsDefault = request.IsDefault,
            IsArchived = request.IsArchived,
            Source = request.Source,
        };
        db.HourlyRates.Add(rate);
        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return HourlyRateDto.From(rate);
    }

    public async Task<HourlyRateDto> Update(Guid rateId, UpdateHourlyRateRequest request, CancellationToken cancellationToken)
    {
        var rate = await Managed(rateId, cancellationToken);
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var type = request.Type.Or(rate.Type);
        var isDefault = request.IsDefault.Or(rate.IsDefault);
        var isArchived = request.IsArchived.Or(rate.IsArchived);
        if (isDefault && type != RateType.Volunteer)
        {
            throw ApiException.Validation("Only a volunteer rate can be the default.");
        }

        if (isDefault && isArchived)
        {
            throw ApiException.Validation("The default volunteer rate cannot be archived.");
        }

        if (rate.IsDefault && !isDefault)
        {
            throw ApiException.Validation("Choose another default volunteer rate first.");
        }

        if (isDefault && !rate.IsDefault)
        {
            await ClearDefault(rate.OrganizationId, rate.Id, cancellationToken);
        }

        rate.Type = type;
        rate.Name = request.Name.Or(rate.Name);
        rate.PerHourRate = request.PerHourRate.Or(rate.PerHourRate);
        rate.IsDefault = isDefault;
        rate.IsArchived = isArchived;
        if (request.Source.HasValue)
        {
            rate.Source = request.Source.Value;
        }
        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return HourlyRateDto.From(rate);
    }

    public async Task Delete(Guid rateId, CancellationToken cancellationToken)
    {
        var rate = await Managed(rateId, cancellationToken);
        if (rate.IsDefault)
        {
            throw ApiException.Conflict("The default volunteer rate cannot be deleted.");
        }

        if (await db.UserTimeEntries.AnyAsync(entry => entry.HourlyRateId == rate.Id, cancellationToken)
            || await db.CollectiveTimeEntries.AnyAsync(entry => entry.HourlyRateId == rate.Id, cancellationToken))
        {
            throw ApiException.Conflict("Archive this rate instead. Time entries still use it.");
        }

        db.HourlyRates.Remove(rate);
        await db.SaveOrThrowAsync(cancellationToken);
    }

    private async Task ClearDefault(Guid organizationId, Guid? exceptRateId, CancellationToken cancellationToken)
    {
        await db.HourlyRates
            .Where(rate => rate.OrganizationId == organizationId && rate.IsDefault && (exceptRateId == null || rate.Id != exceptRateId))
            .ExecuteUpdateAsync(setters => setters.SetProperty(rate => rate.IsDefault, false), cancellationToken);
    }

    private async Task<HourlyRate> Managed(Guid rateId, CancellationToken cancellationToken)
    {
        var rate = await db.HourlyRates.FirstOrDefaultAsync(item => item.Id == rateId, cancellationToken)
            ?? throw ApiException.NotFound();
        await access.RequireOrganizationAdmin(rate.OrganizationId, cancellationToken);
        return rate;
    }
}

public static class HourlyRatesEndpoints
{
    public static void MapHourlyRatesEndpoints(this IEndpointRouteBuilder app)
    {
        var byOrganization = app.MapGroup("/organizations/{id:guid}/hourly-rates").RequireAuthorization();
        byOrganization.MapGet("", async Task<Ok<ListResponse<HourlyRateDto>>> (Guid id, [AsParameters] PageQuery query, HourlyRatesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, query, ct)));
        byOrganization.MapPost("", async Task<Created<HourlyRateDto>> (Guid id, CreateHourlyRateRequest request, HourlyRatesService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(id, request, ct)));

        var rates = app.MapGroup("/hourly-rates").RequireAuthorization();
        rates.MapPatch("/{id:guid}", async Task<Ok<HourlyRateDto>> (Guid id, UpdateHourlyRateRequest request, HourlyRatesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, request, ct)));
        rates.MapDelete("/{id:guid}", async Task<NoContent> (Guid id, HourlyRatesService service, CancellationToken ct) =>
        {
            await service.Delete(id, ct);
            return TypedResults.NoContent();
        });
    }
}
