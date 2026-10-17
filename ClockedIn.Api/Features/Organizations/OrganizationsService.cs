using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.HourlyRates;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Organizations;

public sealed class OrganizationsService(ClockedInDbContext db, Access access, TimeProvider time)
{
    public async Task<OrganizationDto> Create(NameRequest request, CancellationToken cancellationToken)
    {
        var organization = new Organization
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            RateSourceYear = 2025,
            DefaultRateType = RateType.Volunteer,
            ThemeId = Theme.ClockedInId,
        };
        var defaultRate = HourlyRatesService.SeedDefault(organization.Id);
        db.Organizations.Add(organization);
        db.HourlyRates.Add(defaultRate);
        db.OrganizationMemberships.Add(new OrganizationMembership
        {
            Id = Guid.NewGuid(),
            UserId = access.Caller.Id,
            OrganizationId = organization.Id,
            RoleId = Role.AdminId,
            RateType = organization.DefaultRateType,
            IsActive = true,
            JoinedAt = time.UtcNow(),
        });
        await db.SaveOrThrowAsync(cancellationToken);
        organization.Theme = await db.Themes.AsNoTracking().FirstAsync(theme => theme.Id == Theme.ClockedInId, cancellationToken);
        return OrganizationDto.From(organization, defaultRate.PerHourRate);
    }

    public async Task<ListResponse<OrganizationDto>> List(PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        var organizations = db.Organizations.AsNoTracking().Include(organization => organization.Theme).AsQueryable();
        if (!access.Caller.IsSuperAdmin)
        {
            var callerId = access.Caller.Id;
            organizations = organizations.Where(organization =>
                organization.Memberships.Any(membership => membership.UserId == callerId && membership.IsActive));
        }

        var items = await organizations
            .OrderBy(organization => organization.Name)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        var rates = await DefaultRates(items.Select(item => item.Id).ToList(), cancellationToken);
        return ListResponse.Of(items.Select(item => OrganizationDto.From(item, rates.GetValueOrDefault(item.Id, 35.47m))).ToList(), page);
    }

    public async Task<OrganizationDto> Get(Guid organizationId, CancellationToken cancellationToken) =>
        OrganizationDto.From(
            await access.RequireOrganization(organizationId, false, cancellationToken),
            await DefaultVolunteerRate(organizationId, cancellationToken));

    public async Task<OrganizationDto> Update(Guid organizationId, UpdateOrganizationRequest request, CancellationToken cancellationToken)
    {
        var organization = await access.RequireOrganization(organizationId, true, cancellationToken);
        organization.Name = request.Name.Or(organization.Name);
        organization.RateSourceYear = request.RateSourceYear.Or(organization.RateSourceYear);
        organization.DefaultRateType = request.DefaultRateType.Or(organization.DefaultRateType);
        organization.WordmarkUrl = request.WordmarkUrl.Or(organization.WordmarkUrl);
        organization.WordmarkOnLightUrl = request.WordmarkOnLightUrl.Or(organization.WordmarkOnLightUrl);
        organization.MarkUrl = request.MarkUrl.Or(organization.MarkUrl);
        organization.AccentImageUrl = request.AccentImageUrl.Or(organization.AccentImageUrl);
        if (request.VolunteerHourlyRate.HasValue)
        {
            var defaultRate = await db.HourlyRates.FirstOrDefaultAsync(
                rate => rate.OrganizationId == organizationId && rate.IsDefault,
                cancellationToken);
            if (defaultRate is null)
            {
                defaultRate = HourlyRatesService.SeedDefault(organizationId);
                defaultRate.PerHourRate = request.VolunteerHourlyRate.Value;
                db.HourlyRates.Add(defaultRate);
            }
            else
            {
                defaultRate.PerHourRate = request.VolunteerHourlyRate.Value;
            }
        }
        if (request.Preferences.HasValue)
        {
            organization.Preferences.AllowTimeEntryEditing = request.Preferences.Value.AllowTimeEntryEditing;
            organization.Preferences.EntityLabels = request.Preferences.Value.EntityLabels.ToEntity();
        }

        if (request.ThemeId.HasValue)
        {
            await AssignTheme(organization, request.ThemeId.Value, cancellationToken);
        }

        await db.SaveOrThrowAsync(cancellationToken);
        await db.Entry(organization).Reference(item => item.Theme).LoadAsync(cancellationToken);
        return OrganizationDto.From(organization, await DefaultVolunteerRate(organizationId, cancellationToken));
    }

    public async Task Delete(Guid organizationId, CancellationToken cancellationToken)
    {
        var organization = await access.RequireOrganization(organizationId, true, cancellationToken);
        if (await db.UserTimeEntries.AnyAsync(entry => entry.OrganizationId == organizationId, cancellationToken)
            || await db.CollectiveTimeEntries.AnyAsync(entry => entry.OrganizationId == organizationId, cancellationToken))
        {
            throw ApiException.Conflict("Delete the time entries first.");
        }

        db.Organizations.Remove(organization);
        await db.SaveOrThrowAsync(cancellationToken);
    }

    public async Task AssignTheme(Organization organization, Guid themeId, CancellationToken cancellationToken)
    {
        var theme = await db.Themes.FirstOrDefaultAsync(
            item => item.Id == themeId && (item.OrganizationId == null || item.OrganizationId == organization.Id),
            cancellationToken) ?? throw ApiException.NotFound();
        organization.ThemeId = theme.Id;
        organization.Theme = theme;
    }

    private async Task<decimal> DefaultVolunteerRate(Guid organizationId, CancellationToken cancellationToken)
    {
        var rate = await db.HourlyRates.AsNoTracking()
            .Where(item => item.OrganizationId == organizationId && item.IsDefault)
            .Select(item => (decimal?)item.PerHourRate)
            .FirstOrDefaultAsync(cancellationToken);
        return rate is > 0 ? rate.Value : 35.47m;
    }

    private async Task<Dictionary<Guid, decimal>> DefaultRates(List<Guid> organizationIds, CancellationToken cancellationToken)
    {
        if (organizationIds.Count == 0)
        {
            return [];
        }

        return await db.HourlyRates.AsNoTracking()
            .Where(rate => organizationIds.Contains(rate.OrganizationId) && rate.IsDefault)
            .ToDictionaryAsync(rate => rate.OrganizationId, rate => rate.PerHourRate, cancellationToken);
    }
}
