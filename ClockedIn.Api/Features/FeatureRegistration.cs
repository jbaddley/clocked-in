using ClockedIn.Api.Features.ApiKeys;
using ClockedIn.Api.Features.Auth;
using ClockedIn.Api.Features.Collective;
using ClockedIn.Api.Features.Connections;
using ClockedIn.Api.Features.Departments;
using ClockedIn.Api.Features.Feedback;
using ClockedIn.Api.Features.HourlyRates;
using ClockedIn.Api.Features.Imports;
using ClockedIn.Api.Features.Invitations;
using ClockedIn.Api.Features.Memberships;
using ClockedIn.Api.Features.Organizations;
using ClockedIn.Api.Features.Projects;
using ClockedIn.Api.Features.Reports;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Features.Tags;
using ClockedIn.Api.Features.TaskCategories;
using ClockedIn.Api.Features.Themes;
using ClockedIn.Api.Features.TimeEntries;
using ClockedIn.Api.Features.Users;

namespace ClockedIn.Api.Features;

public static class FeatureRegistration
{
    public static IServiceCollection AddClockedInFeatures(this IServiceCollection services)
    {
        services.AddScoped<Access>();
        services.AddScoped<EntryRules>();
        services.AddScoped<AuthService>();
        services.AddScoped<UsersService>();
        services.AddScoped<MembershipsService>();
        services.AddScoped<ConnectionsService>();
        services.AddScoped<OrganizationsService>();
        services.AddScoped<HourlyRatesService>();
        services.AddScoped<DepartmentsService>();
        services.AddScoped<TagsService>();
        services.AddScoped<TaskCategoriesService>();
        services.AddScoped<ProjectsService>();
        services.AddScoped<ImportsService>();
        services.AddScoped<InvitationsService>();
        services.AddScoped<TimeEntriesService>();
        services.AddScoped<CollectiveService>();
        services.AddScoped<ReportsService>();
        services.AddScoped<ThemesService>();
        services.AddScoped<FeedbackService>();
        services.AddScoped<OrganizationApiKeysService>();
        services.AddScoped<PlatformApiKeysService>();
        return services;
    }

    public static IEndpointRouteBuilder MapClockedInEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapAuthEndpoints();
        app.MapMembershipsEndpoints();
        app.MapConnectionsEndpoints();
        app.MapUsersEndpoints();
        app.MapOrganizationsEndpoints();
        app.MapHourlyRatesEndpoints();
        app.MapReportsEndpoints();
        app.MapDepartmentsEndpoints();
        app.MapTagsEndpoints();
        app.MapTaskCategoriesEndpoints();
        app.MapProjectsEndpoints();
        app.MapImportsEndpoints();
        app.MapInvitationsEndpoints();
        app.MapTimeEntriesEndpoints();
        app.MapCollectiveEndpoints();
        app.MapThemesEndpoints();
        app.MapFeedbackEndpoints();
        app.MapOrganizationApiKeysEndpoints();
        app.MapPlatformApiKeysEndpoints();
        return app;
    }
}
