using System.Text.Json;
using ClockedIn.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql.NameTranslation;

namespace ClockedIn.Api.Data;

public class ClockedInDbContext(DbContextOptions<ClockedInDbContext> options, TimeProvider time) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<AccessRequest> AccessRequests => Set<AccessRequest>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Theme> Themes => Set<Theme>();
    public DbSet<HourlyRate> HourlyRates => Set<HourlyRate>();
    public DbSet<OrganizationMembership> OrganizationMemberships => Set<OrganizationMembership>();
    public DbSet<MemberConnection> MemberConnections => Set<MemberConnection>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<DepartmentMembership> DepartmentMemberships => Set<DepartmentMembership>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<TaskCategory> TaskCategories => Set<TaskCategory>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<UserTimeEntry> UserTimeEntries => Set<UserTimeEntry>();
    public DbSet<CollectiveTimeEntry> CollectiveTimeEntries => Set<CollectiveTimeEntry>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<PasswordResetCode> PasswordResetCodes => Set<PasswordResetCode>();
    public DbSet<Feedback> Feedback => Set<Feedback>();
    public DbSet<FeedbackAction> FeedbackActions => Set<FeedbackAction>();
    public DbSet<OrganizationApiKey> OrganizationApiKeys => Set<OrganizationApiKey>();
    public DbSet<PlatformApiKey> PlatformApiKeys => Set<PlatformApiKey>();
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<ReportTemplate> ReportTemplates => Set<ReportTemplate>();
    public DbSet<VolunteerNeed> VolunteerNeeds => Set<VolunteerNeed>();
    public DbSet<Guest> Guests => Set<Guest>();
    public DbSet<VolunteerSignup> VolunteerSignups => Set<VolunteerSignup>();

    public override int SaveChanges()
    {
        TouchUsers();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TouchUsers();
        return base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("citext");
        modelBuilder.HasPostgresEnum<TimeEntryMode>(
            name: "TimeEntryMode",
            nameTranslator: new NpgsqlNullNameTranslator());

        modelBuilder.Entity<User>(entity =>
        {
            entity.Property(user => user.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(user => user.IsSuperAdmin).HasDefaultValue(false);
            entity.Property(user => user.MustChangePassword).HasDefaultValue(false);
            entity.HasIndex(user => user.Username).IsUnique();
            entity.HasIndex(user => user.Email).IsUnique();
            entity.ToTable(table => table.HasCheckConstraint(
                "User_lowercase_identity_check",
                "\"username\" = lower(\"username\") AND \"email\" = lower(\"email\")"));
        });

        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.Property(profile => profile.Timezone).HasDefaultValue("UTC");
            entity.HasIndex(profile => profile.UserId).IsUnique();
            entity.HasOne(profile => profile.User)
                .WithOne(user => user.Profile)
                .HasForeignKey<UserProfile>(profile => profile.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.Property(role => role.IsSystem).HasDefaultValue(false);
            entity.Property(role => role.Scope).HasDefaultValue("organization");
            entity.HasIndex(role => role.Code)
                .IsUnique()
                .HasFilter("\"organizationId\" IS NULL")
                .HasDatabaseName("Role_system_code_key");
            entity.HasIndex(role => new { role.OrganizationId, role.Code })
                .IsUnique()
                .HasFilter("\"organizationId\" IS NOT NULL")
                .HasDatabaseName("Role_org_code_key");
            entity.HasOne(role => role.Organization)
                .WithMany()
                .HasForeignKey(role => role.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasData(
                new Role { Id = Role.MemberId, Code = "MEMBER", Name = "Member", IsSystem = true },
                new Role { Id = Role.VolunteerId, Code = "VOLUNTEER", Name = "Volunteer", IsSystem = true, Scope = "self" },
                new Role { Id = Role.AdminId, Code = "ADMIN", Name = "Admin", IsSystem = true });
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.Property(permission => permission.Allowed).HasDefaultValue(true);
            entity.HasIndex(permission => new { permission.RoleId, permission.Permission }).IsUnique();
            entity.HasOne(permission => permission.Role)
                .WithMany(role => role.Permissions)
                .HasForeignKey(permission => permission.RoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AccessRequest>(entity =>
        {
            entity.Property(request => request.RequestedDepartmentIds)
                .HasColumnType("jsonb")
                .HasDefaultValueSql("'[]'::jsonb");
            entity.Property(request => request.Status).HasDefaultValue("pending");
            entity.Property(request => request.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(request => request.OrganizationId);
            entity.HasIndex(request => request.UserId);
            entity.HasIndex(request => request.Status);
            entity.HasOne(request => request.Organization)
                .WithMany(organization => organization.AccessRequests)
                .HasForeignKey(request => request.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(request => request.User)
                .WithMany(user => user.AccessRequests)
                .HasForeignKey(request => request.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(request => request.Guest)
                .WithMany(guest => guest.AccessRequests)
                .HasForeignKey(request => request.GuestId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(request => request.RequestedRole)
                .WithMany()
                .HasForeignKey(request => request.RequestedRoleId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(request => request.ReviewedBy)
                .WithMany(user => user.AccessRequestsReviewed)
                .HasForeignKey(request => request.ReviewedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(request => request.VolunteerNeed)
                .WithMany(need => need.AccessRequests)
                .HasForeignKey(request => request.VolunteerNeedId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Organization>(entity =>
        {
            entity.Property(organization => organization.DefaultRateType)
                .HasConversion<string>()
                .HasDefaultValue(RateType.Volunteer);
            entity.Property(organization => organization.ThemeId).HasDefaultValue(Theme.ClockedInId);
            entity.HasOne(organization => organization.Theme)
                .WithMany(theme => theme.AssignedOrganizations)
                .HasForeignKey(organization => organization.ThemeId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(organization => organization.Themes)
                .WithOne(theme => theme.Organization)
                .HasForeignKey(theme => theme.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.OwnsOne(organization => organization.Preferences, owned =>
            {
                owned.ToJson("preferences");
                owned.OwnsOne(preferences => preferences.EntityLabels);
                owned.PrimitiveCollection(preferences => preferences.FeedbackNotifyUserIds);
            });
            entity.HasIndex(organization => organization.PublicSlug)
                .IsUnique()
                .HasFilter("\"publicSlug\" IS NOT NULL")
                .HasDatabaseName("IX_Organization_publicSlug");
            entity.ToTable(table => table.HasCheckConstraint(
                "Organization_rate_check",
                "\"defaultRateType\" IN ('Volunteer', 'Professional')"));
        });

        modelBuilder.Entity<HourlyRate>(entity =>
        {
            entity.Property(rate => rate.Name).HasColumnType("citext");
            entity.Property(rate => rate.Type).HasConversion<string>();
            entity.Property(rate => rate.PerHourRate).HasPrecision(10, 2);
            entity.Property(rate => rate.IsDefault).HasDefaultValue(false);
            entity.Property(rate => rate.IsArchived).HasDefaultValue(false);
            entity.HasIndex(rate => new { rate.OrganizationId, rate.Name }).IsUnique();
            entity.HasIndex(rate => rate.OrganizationId)
                .IsUnique()
                .HasFilter("\"isDefault\" = TRUE AND \"type\" = 'Volunteer'")
                .HasDatabaseName("HourlyRate_default_volunteer_key");
            entity.HasOne(rate => rate.Organization)
                .WithMany(organization => organization.HourlyRates)
                .HasForeignKey(rate => rate.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.ToTable(table => table.HasCheckConstraint(
                "HourlyRate_rate_check",
                """
                "type" IN ('Volunteer', 'Professional')
                AND "perHourRate" > 0
                AND (
                  ("isDefault" = FALSE)
                  OR ("type" = 'Volunteer')
                )
                AND ("source" IS NULL OR char_length("source") BETWEEN 1 AND 200)
                """));
        });

        modelBuilder.Entity<Theme>(entity =>
        {
            entity.HasIndex(theme => theme.Name)
                .IsUnique()
                .HasFilter("\"organizationId\" IS NULL")
                .HasDatabaseName("Theme_global_name_key");
            entity.HasIndex(theme => new { theme.OrganizationId, theme.Name })
                .IsUnique()
                .HasFilter("\"organizationId\" IS NOT NULL")
                .HasDatabaseName("Theme_organization_name_key");
            entity.HasData(GlobalThemes.All());
            entity.ToTable(table => table.HasCheckConstraint(
                "Theme_token_check",
                """
                "primary" ~ '^#[0-9A-Fa-f]{6}$'
                AND "primaryForeground" ~ '^#[0-9A-Fa-f]{6}$'
                AND "highlight" ~ '^#[0-9A-Fa-f]{6}$'
                AND "accent" ~ '^#[0-9A-Fa-f]{6}$'
                AND "success" ~ '^#[0-9A-Fa-f]{6}$'
                AND "surface" ~ '^#[0-9A-Fa-f]{6}$'
                AND "surfaceForeground" ~ '^#[0-9A-Fa-f]{6}$'
                AND "foreground" ~ '^#[0-9A-Fa-f]{6}$'
                AND "chartColor" ~ '^#[0-9A-Fa-f]{6}$'
                AND "headingFont" IN ('HelveticaNeue', 'AvenirNext', 'SourceSans3', 'NunitoSans', 'Geist')
                AND "bodyFont" IN ('HelveticaNeue', 'AvenirNext', 'SourceSans3', 'NunitoSans', 'Geist')
                AND left("categoricalPalette", 1) = '['
                AND left("sequentialPalette", 1) = '['
                AND left("divergingPalette", 1) = '['
                """));
        });

        modelBuilder.Entity<OrganizationMembership>(entity =>
        {
            entity.Property(membership => membership.JoinedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(membership => membership.RateType)
                .HasConversion<string>()
                .HasDefaultValue(RateType.Volunteer);
            entity.Property(membership => membership.IsActive).HasDefaultValue(true);
            entity.Property(membership => membership.ProfessionalBillingRate).HasPrecision(10, 2);
            entity.HasIndex(membership => new { membership.UserId, membership.OrganizationId }).IsUnique();
            entity.HasOne(membership => membership.User)
                .WithMany(user => user.OrganizationMemberships)
                .HasForeignKey(membership => membership.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(membership => membership.Organization)
                .WithMany(organization => organization.Memberships)
                .HasForeignKey(membership => membership.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(membership => membership.Role)
                .WithMany(role => role.OrganizationMemberships)
                .HasForeignKey(membership => membership.RoleId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(membership => membership.PrimaryDepartment)
                .WithMany(department => department.PrimaryMemberships)
                .HasForeignKey(membership => membership.PrimaryDepartmentId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.ToTable(table => table.HasCheckConstraint(
                "OrganizationMembership_rate_check",
                """
                "rateType" IN ('Volunteer', 'Professional')
                AND (
                  ("rateType" = 'Volunteer' AND "professionalBillingRate" IS NULL)
                  OR (
                    "rateType" = 'Professional'
                    AND "professionalBillingRate" IS NOT NULL
                    AND "professionalBillingRate" > 0
                  )
                )
                """));
        });

        modelBuilder.Entity<Report>(entity =>
        {
            entity.Property(report => report.Name).HasColumnType("citext");
            entity.Property(report => report.IsDefault).HasDefaultValue(false);
            entity.Property(report => report.Layout)
                .HasColumnType("jsonb")
                .HasDefaultValueSql("""'{"version":1,"cards":[]}'::jsonb""");
            entity.Property(report => report.Filters)
                .HasColumnType("jsonb")
                .HasDefaultValueSql("'{}'::jsonb");
            entity.Property(report => report.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(report => report.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(report => new { report.OrganizationId, report.Name }).IsUnique();
            entity.HasIndex(report => report.OrganizationId)
                .IsUnique()
                .HasFilter("\"isDefault\" = TRUE")
                .HasDatabaseName("Report_one_default");
            entity.HasOne(report => report.Organization)
                .WithMany(organization => organization.Reports)
                .HasForeignKey(report => report.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.ToTable(table => table.HasCheckConstraint(
                "Report_name_check",
                """char_length(btrim("name"::text)) BETWEEN 1 AND 80"""));
        });

        modelBuilder.Entity<ReportTemplate>(entity =>
        {
            entity.Property(template => template.Name).HasColumnType("citext");
            entity.Property(template => template.Layout)
                .HasColumnType("jsonb")
                .HasDefaultValueSql("""'{"version":1,"cards":[]}'::jsonb""");
            entity.Property(template => template.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(template => template.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(template => template.Key)
                .IsUnique()
                .HasFilter("\"organizationId\" IS NULL AND \"key\" IS NOT NULL")
                .HasDatabaseName("ReportTemplate_global_key");
            entity.HasIndex(template => template.Name)
                .IsUnique()
                .HasFilter("\"organizationId\" IS NULL")
                .HasDatabaseName("ReportTemplate_global_name");
            entity.HasIndex(template => new { template.OrganizationId, template.BaseTemplateId })
                .IsUnique()
                .HasFilter("\"baseTemplateId\" IS NOT NULL")
                .HasDatabaseName("ReportTemplate_override");
            entity.HasIndex(template => new { template.OrganizationId, template.Name })
                .IsUnique()
                .HasFilter("\"organizationId\" IS NOT NULL")
                .HasDatabaseName("ReportTemplate_org_name");
            entity.HasOne(template => template.Organization)
                .WithMany(organization => organization.ReportTemplates)
                .HasForeignKey(template => template.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(template => template.BaseTemplate)
                .WithMany(template => template.Overrides)
                .HasForeignKey(template => template.BaseTemplateId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.ToTable(table => table.HasCheckConstraint(
                "ReportTemplate_shape_check",
                """
                char_length(btrim("name"::text)) BETWEEN 1 AND 80
                AND (
                  ("organizationId" IS NULL AND "baseTemplateId" IS NULL AND "key" IN ('summary', 'people', 'groups', 'staff'))
                  OR ("organizationId" IS NOT NULL AND "key" IS NULL AND "baseTemplateId" IS NULL)
                  OR ("organizationId" IS NOT NULL AND "key" IS NULL AND "baseTemplateId" IS NOT NULL)
                )
                """));
        });

        modelBuilder.Entity<MemberConnection>(entity =>
        {
            entity.Property(connection => connection.Relationship).HasConversion<string>();
            entity.Property(connection => connection.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(connection => new { connection.OrganizationId, connection.UserAId, connection.UserBId })
                .IsUnique()
                .HasDatabaseName("MemberConnection_pair_key");
            entity.HasOne(connection => connection.Organization)
                .WithMany(organization => organization.Connections)
                .HasForeignKey(connection => connection.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(connection => connection.UserA)
                .WithMany()
                .HasForeignKey(connection => connection.UserAId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(connection => connection.UserB)
                .WithMany()
                .HasForeignKey(connection => connection.UserBId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(connection => connection.CreatedBy)
                .WithMany()
                .HasForeignKey(connection => connection.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.ToTable(table => table.HasCheckConstraint(
                "MemberConnection_pair_check",
                """
                "userAId" <> "userBId"
                AND "userAId"::text < "userBId"::text
                AND "relationship" IN (
                  'Parent', 'Child', 'Spouse', 'Sibling', 'Grandparent', 'Grandchild',
                  'Guardian', 'Dependent', 'Friend', 'Colleague', 'Associate'
                )
                """));
        });

        modelBuilder.Entity<Department>(entity =>
        {
            entity.Property(department => department.Name).HasColumnType("citext");
            entity.HasIndex(department => new { department.OrganizationId, department.Name }).IsUnique();
            entity.HasOne(department => department.Organization)
                .WithMany(organization => organization.Departments)
                .HasForeignKey(department => department.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DepartmentMembership>(entity =>
        {
            entity.Property(membership => membership.JoinedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(membership => new { membership.UserId, membership.DepartmentId }).IsUnique();
            entity.HasOne(membership => membership.User)
                .WithMany(user => user.DepartmentMemberships)
                .HasForeignKey(membership => membership.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(membership => membership.Department)
                .WithMany(department => department.Memberships)
                .HasForeignKey(membership => membership.DepartmentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(membership => membership.Role)
                .WithMany(role => role.DepartmentMemberships)
                .HasForeignKey(membership => membership.RoleId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Tag>(entity =>
        {
            entity.Property(tag => tag.Name).HasColumnType("citext");
            entity.Property(tag => tag.IsArchived).HasDefaultValue(false);
            entity.HasIndex(tag => new { tag.OrganizationId, tag.Name }).IsUnique();
            entity.HasOne(tag => tag.Organization)
                .WithMany(organization => organization.Tags)
                .HasForeignKey(tag => tag.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TaskCategory>(entity =>
        {
            entity.Property(category => category.Name).HasColumnType("citext");
            entity.HasIndex(category => new { category.OrganizationId, category.Name }).IsUnique();
            entity.HasOne(category => category.Organization)
                .WithMany(organization => organization.TaskCategories)
                .HasForeignKey(category => category.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.Property(project => project.Title).HasColumnType("citext");
            entity.Property(project => project.AccessType).HasConversion<string>();
            entity.Property(project => project.ProjectType)
                .HasConversion<string>()
                .HasDefaultValue(ProjectType.Project);
            entity.Property(project => project.IsActive).HasDefaultValue(true);
            entity.Property(project => project.StartDate).HasColumnType("date");
            entity.Property(project => project.EndDate).HasColumnType("date");
            entity.HasIndex(project => new { project.OrganizationId, project.Title }).IsUnique();
            entity.HasOne(project => project.Organization)
                .WithMany(organization => organization.Projects)
                .HasForeignKey(project => project.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(project => project.Department)
                .WithMany(department => department.Projects)
                .HasForeignKey(project => project.DepartmentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(project => project.Owner)
                .WithMany(user => user.OwnedProjects)
                .HasForeignKey(project => project.OwnerUserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(project => project.Editors)
                .WithMany(user => user.EditableProjects)
                .UsingEntity(
                    "ProjectEditor",
                    user => user.HasOne(typeof(User)).WithMany().HasForeignKey("UserId").OnDelete(DeleteBehavior.Cascade),
                    projectSide => projectSide.HasOne(typeof(Project)).WithMany().HasForeignKey("ProjectId").OnDelete(DeleteBehavior.Cascade),
                    join => join.HasKey("ProjectId", "UserId"));
            entity.ToTable(table => table.HasCheckConstraint(
                "Project_access_check",
                """
                "projectType" IN ('Project', 'Event')
                AND "accessType" IN ('Public', 'Private', 'Department')
                AND (
                  ("accessType" = 'Department' AND "departmentId" IS NOT NULL)
                  OR ("accessType" IN ('Public', 'Private') AND "departmentId" IS NULL)
                )
                AND (
                  "startDate" IS NULL
                  OR "endDate" IS NULL
                  OR "endDate" >= "startDate"
                )
                """));
        });

        modelBuilder.Entity<UserTimeEntry>(entity =>
        {
            entity.Property(entry => entry.OccurredOn).HasColumnType("date");
            entity.Property(entry => entry.HourlyRate).HasPrecision(10, 2);
            entity.Property(entry => entry.InKindValue).HasPrecision(12, 2);
            entity.Property(entry => entry.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(entry => entry.SourceRef).IsUnique();
            entity.HasIndex(entry => new { entry.OrganizationId, entry.OccurredOn });
            entity.HasIndex(entry => new { entry.UserId, entry.OccurredOn });
            entity.HasOne(entry => entry.User)
                .WithMany(user => user.TimeEntries)
                .HasForeignKey(entry => entry.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(entry => entry.EnteredBy)
                .WithMany(user => user.TimeEntriesEntered)
                .HasForeignKey(entry => entry.EnteredByUserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(entry => entry.Organization)
                .WithMany(organization => organization.TimeEntries)
                .HasForeignKey(entry => entry.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(entry => entry.Department)
                .WithMany(department => department.TimeEntries)
                .HasForeignKey(entry => entry.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(entry => entry.Project)
                .WithMany(project => project.UserTimeEntries)
                .HasForeignKey(entry => entry.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(entry => entry.TaskCategory)
                .WithMany(category => category.UserTimeEntries)
                .HasForeignKey(entry => entry.TaskCategoryId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(entry => entry.Rate)
                .WithMany(rate => rate.UserTimeEntries)
                .HasForeignKey(entry => entry.HourlyRateId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(entry => entry.Tags)
                .WithMany(tag => tag.UserTimeEntries)
                .UsingEntity(
                    "UserTimeEntryTag",
                    tag => tag.HasOne(typeof(Tag)).WithMany().HasForeignKey("TagId").OnDelete(DeleteBehavior.Cascade),
                    entrySide => entrySide.HasOne(typeof(UserTimeEntry)).WithMany().HasForeignKey("UserTimeEntryId").OnDelete(DeleteBehavior.Cascade),
                    join => join.HasKey("UserTimeEntryId", "TagId"));
            entity.ToTable(table => table.HasCheckConstraint(
                "UserTimeEntry_mode_check",
                """
                (
                  ("mode" IN ('Punch', 'Duration') AND "hourlyRate" > 0)
                  OR ("mode" = 'Total' AND "hourlyRate" >= 0)
                )
                AND (
                  (
                    "mode" = 'Punch'
                    AND "startedAt" IS NOT NULL
                    AND (
                      (
                        "endedAt" IS NULL
                        AND "durationMinutes" IS NULL
                        AND "inKindValue" IS NULL
                      )
                      OR (
                        "endedAt" IS NOT NULL
                        AND "endedAt" > "startedAt"
                        AND "durationMinutes" BETWEEN 1 AND 1440
                        AND "durationMinutes" = FLOOR(EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60)::integer
                        AND "inKindValue" IS NOT NULL
                        AND "inKindValue" = ROUND(("durationMinutes"::numeric * "hourlyRate") / 60, 2)
                      )
                    )
                  )
                  OR (
                    "mode" = 'Duration'
                    AND "durationMinutes" BETWEEN 1 AND 1440
                    AND "inKindValue" IS NOT NULL
                    AND "inKindValue" = ROUND(("durationMinutes"::numeric * "hourlyRate") / 60, 2)
                    AND (
                      ("startedAt" IS NULL AND "endedAt" IS NULL)
                      OR (
                        "startedAt" IS NOT NULL
                        AND "endedAt" IS NOT NULL
                        AND "endedAt" > "startedAt"
                        AND "durationMinutes" = FLOOR(EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60)::integer
                      )
                    )
                  )
                  OR (
                    "mode" = 'Total'
                    AND "durationMinutes" BETWEEN 1 AND 59940
                    AND "hourlyRate" >= 0
                    AND "inKindValue" IS NOT NULL
                    AND "inKindValue" = ROUND(("durationMinutes"::numeric * "hourlyRate") / 60, 2)
                  )
                )
                """));
        });

        modelBuilder.Entity<CollectiveTimeEntry>(entity =>
        {
            entity.Property(entry => entry.HourlyRate).HasPrecision(10, 2);
            entity.Property(entry => entry.InKindValue).HasPrecision(12, 2);
            entity.Property(entry => entry.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(entry => new { entry.OrganizationId, entry.StartedAt });
            entity.HasOne(entry => entry.RecordedBy)
                .WithMany(user => user.CollectiveTimeEntries)
                .HasForeignKey(entry => entry.RecordedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(entry => entry.Organization)
                .WithMany(organization => organization.CollectiveTimeEntries)
                .HasForeignKey(entry => entry.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(entry => entry.Department)
                .WithMany(department => department.CollectiveTimeEntries)
                .HasForeignKey(entry => entry.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(entry => entry.Project)
                .WithMany(project => project.CollectiveTimeEntries)
                .HasForeignKey(entry => entry.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(entry => entry.TaskCategory)
                .WithMany(category => category.CollectiveTimeEntries)
                .HasForeignKey(entry => entry.TaskCategoryId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(entry => entry.Rate)
                .WithMany(rate => rate.CollectiveTimeEntries)
                .HasForeignKey(entry => entry.HourlyRateId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(entry => entry.Tags)
                .WithMany(tag => tag.CollectiveTimeEntries)
                .UsingEntity(
                    "CollectiveTimeEntryTag",
                    tag => tag.HasOne(typeof(Tag)).WithMany().HasForeignKey("TagId").OnDelete(DeleteBehavior.Cascade),
                    entrySide => entrySide.HasOne(typeof(CollectiveTimeEntry)).WithMany().HasForeignKey("CollectiveTimeEntryId").OnDelete(DeleteBehavior.Cascade),
                    join => join.HasKey("CollectiveTimeEntryId", "TagId"));
            entity.ToTable(table => table.HasCheckConstraint(
                "CollectiveTimeEntry_span_check",
                """
                "endedAt" > "startedAt"
                AND "participantCount" >= 1
                AND "hourlyRate" > 0
                AND "inKindValue" = ROUND(
                  (EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 3600.0)
                  * "participantCount"
                  * "hourlyRate"
                , 2)
                """));
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasIndex(token => token.TokenHash).IsUnique();
            entity.HasOne(token => token.User)
                .WithMany(user => user.RefreshTokens)
                .HasForeignKey(token => token.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrganizationApiKey>(entity =>
        {
            entity.Property(key => key.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(key => key.Prefix);
            entity.HasIndex(key => key.KeyHash).IsUnique();
            entity.HasOne(key => key.Organization)
                .WithMany(organization => organization.ApiKeys)
                .HasForeignKey(key => key.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(key => key.CreatedBy)
                .WithMany(user => user.OrganizationApiKeysCreated)
                .HasForeignKey(key => key.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PlatformApiKey>(entity =>
        {
            entity.Property(key => key.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(key => key.Prefix);
            entity.HasIndex(key => key.KeyHash).IsUnique();
            entity.HasOne(key => key.CreatedBy)
                .WithMany(user => user.PlatformApiKeysCreated)
                .HasForeignKey(key => key.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Invitation>(entity =>
        {
            entity.Property(invitation => invitation.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(invitation => invitation.CodeHash).IsUnique();
            entity.HasIndex(invitation => invitation.Email);
            entity.HasIndex(invitation => new { invitation.Email, invitation.OrganizationId })
                .IsUnique()
                .HasFilter("\"departmentId\" IS NULL AND \"acceptedAt\" IS NULL AND \"revokedAt\" IS NULL")
                .HasDatabaseName("Invitation_pending_org_key");
            entity.HasIndex(invitation => new { invitation.Email, invitation.DepartmentId })
                .IsUnique()
                .HasFilter("\"departmentId\" IS NOT NULL AND \"acceptedAt\" IS NULL AND \"revokedAt\" IS NULL")
                .HasDatabaseName("Invitation_pending_department_key");
            entity.HasOne(invitation => invitation.Organization)
                .WithMany(organization => organization.Invitations)
                .HasForeignKey(invitation => invitation.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(invitation => invitation.Department)
                .WithMany(department => department.Invitations)
                .HasForeignKey(invitation => invitation.DepartmentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(invitation => invitation.Role)
                .WithMany(role => role.Invitations)
                .HasForeignKey(invitation => invitation.RoleId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(invitation => invitation.InvitedBy)
                .WithMany(user => user.InvitationsSent)
                .HasForeignKey(invitation => invitation.InvitedByUserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.ToTable(table => table.HasCheckConstraint(
                "Invitation_lowercase_email_check",
                "\"email\" = lower(\"email\")"));
        });

        modelBuilder.Entity<PasswordResetCode>(entity =>
        {
            entity.Property(code => code.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(code => code.CodeHash).IsUnique();
            entity.HasIndex(code => code.UserId);
            entity.HasOne(code => code.User)
                .WithMany(user => user.PasswordResetCodes)
                .HasForeignKey(code => code.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Feedback>(entity =>
        {
            entity.Property(feedback => feedback.Type).HasConversion<string>();
            entity.Property(feedback => feedback.Priority).HasConversion<string>();
            entity.Property(feedback => feedback.Area).HasConversion<string>();
            entity.Property(feedback => feedback.Status)
                .HasConversion<string>()
                .HasDefaultValue(FeedbackStatus.Pending);
            entity.Property(feedback => feedback.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.PrimitiveCollection(feedback => feedback.ScreenshotUrls).HasColumnType("jsonb");
            entity.HasIndex(feedback => feedback.Status);
            entity.HasIndex(feedback => feedback.CreatedAt);
            entity.HasIndex(feedback => feedback.UserId);
            entity.HasOne(feedback => feedback.User)
                .WithMany(user => user.Feedback)
                .HasForeignKey(feedback => feedback.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(feedback => feedback.Organization)
                .WithMany(organization => organization.Feedback)
                .HasForeignKey(feedback => feedback.OrganizationId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.ToTable(table => table.HasCheckConstraint(
                "Feedback_values_check",
                """
                "type" IN ('Bug', 'Feature')
                AND "priority" IN ('Urgent', 'High', 'Medium', 'Low')
                AND "area" IN ('Dashboard', 'LogTime', 'Entries', 'Reports', 'Settings', 'Other')
                AND "status" IN ('Pending', 'Acknowledged', 'Planned', 'InProgress', 'Resolved', 'Cancelled', 'CouldNotReproduce', 'Archived')
                AND char_length("title") BETWEEN 1 AND 120
                AND char_length("description") BETWEEN 1 AND 4000
                AND left("screenshotUrls"::text, 1) = '['
                AND ("githubIssueNumber" IS NULL OR "githubIssueNumber" > 0)
                """));
        });

        modelBuilder.Entity<FeedbackAction>(entity =>
        {
            entity.Property(action => action.PreviousStatus).HasConversion<string>();
            entity.Property(action => action.UpdatedStatus).HasConversion<string>();
            entity.HasIndex(action => action.FeedbackId);
            entity.HasOne(action => action.Feedback)
                .WithMany(feedback => feedback.Actions)
                .HasForeignKey(action => action.FeedbackId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(action => action.TakenBy)
                .WithMany(user => user.FeedbackActionsTaken)
                .HasForeignKey(action => action.TakenByUserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.ToTable(table => table.HasCheckConstraint(
                "FeedbackAction_values_check",
                """
                "previousStatus" IN ('Pending', 'Acknowledged', 'Planned', 'InProgress', 'Resolved', 'Cancelled', 'CouldNotReproduce', 'Archived')
                AND "updatedStatus" IN ('Pending', 'Acknowledged', 'Planned', 'InProgress', 'Resolved', 'Cancelled', 'CouldNotReproduce', 'Archived')
                AND char_length("description") BETWEEN 1 AND 2000
                """));
        });

        modelBuilder.Entity<VolunteerNeed>(entity =>
        {
            entity.Property(need => need.Name).HasColumnType("citext");
            entity.Property(need => need.Type).HasConversion<string>();
            entity.Property(need => need.CountVetted).HasDefaultValue(0);
            entity.Property(need => need.AllowPublic).HasDefaultValue(false);
            entity.Property(need => need.RequireVetting).HasDefaultValue(false);
            entity.Property(need => need.Questions)
                .HasColumnType("jsonb")
                .HasDefaultValueSql("""'{"version":1,"items":[]}'::jsonb""");
            entity.Property(need => need.StartDate).HasColumnType("date");
            entity.Property(need => need.EndDate).HasColumnType("date");
            entity.Property(need => need.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(need => need.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(need => need.Status).HasDefaultValue("published");
            entity.HasIndex(need => need.PublicToken).IsUnique();
            entity.HasIndex(need => need.OrganizationId);
            entity.HasOne(need => need.Organization)
                .WithMany(organization => organization.VolunteerNeeds)
                .HasForeignKey(need => need.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(need => need.CreatedBy)
                .WithMany(user => user.VolunteerNeedsCreated)
                .HasForeignKey(need => need.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(need => need.Project)
                .WithMany(project => project.VolunteerNeeds)
                .HasForeignKey(need => need.ProjectId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(need => need.TaskCategory)
                .WithMany(category => category.VolunteerNeeds)
                .HasForeignKey(need => need.TaskCategoryId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(need => need.Department)
                .WithMany(department => department.VolunteerNeeds)
                .HasForeignKey(need => need.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.ToTable(table => table.HasCheckConstraint(
                "VolunteerNeed_values_check",
                """
                "type" IN ('Position', 'Task')
                AND char_length(btrim("name"::text)) BETWEEN 1 AND 200
                AND ("description" IS NULL OR char_length("description") BETWEEN 1 AND 4000)
                AND "countNeeded" BETWEEN 1 AND 10000
                AND "countVetted" >= 0
                AND "countVetted" <= "countNeeded"
                AND ("endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate")
                AND char_length("publicToken") = 32
                AND "publicToken" = lower("publicToken")
                AND left("questions"::text, 1) = '{'
                """));
        });

        modelBuilder.Entity<Guest>(entity =>
        {
            entity.HasIndex(guest => guest.Email).IsUnique();
            entity.HasIndex(guest => guest.UserId)
                .IsUnique()
                .HasFilter("\"userId\" IS NOT NULL")
                .HasDatabaseName("Guest_user");
            entity.HasOne(guest => guest.User)
                .WithMany(user => user.Guests)
                .HasForeignKey(guest => guest.UserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.ToTable(table => table.HasCheckConstraint(
                "Guest_values_check",
                """
                char_length(btrim("name")) BETWEEN 1 AND 120
                AND "email" = lower("email")
                AND char_length(btrim("phone")) BETWEEN 1 AND 40
                """));
        });

        modelBuilder.Entity<VolunteerSignup>(entity =>
        {
            entity.Property(signup => signup.Answers)
                .HasColumnType("jsonb")
                .HasDefaultValueSql("'[]'::jsonb");
            entity.Property(signup => signup.Passed).HasDefaultValue(false);
            entity.Property(signup => signup.Vetted).HasDefaultValue(false);
            entity.Property(signup => signup.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(signup => new { signup.VolunteerNeedId, signup.UserId })
                .IsUnique()
                .HasFilter("\"userId\" IS NOT NULL")
                .HasDatabaseName("VolunteerSignup_need_user");
            entity.HasIndex(signup => new { signup.VolunteerNeedId, signup.GuestId })
                .IsUnique()
                .HasFilter("\"guestId\" IS NOT NULL")
                .HasDatabaseName("VolunteerSignup_need_guest");
            entity.HasOne(signup => signup.VolunteerNeed)
                .WithMany(need => need.Signups)
                .HasForeignKey(signup => signup.VolunteerNeedId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(signup => signup.User)
                .WithMany(user => user.VolunteerSignups)
                .HasForeignKey(signup => signup.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(signup => signup.Guest)
                .WithMany(guest => guest.Signups)
                .HasForeignKey(signup => signup.GuestId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.ToTable(table => table.HasCheckConstraint(
                "VolunteerSignup_person_check",
                """
                (("userId" IS NOT NULL AND "guestId" IS NULL) OR ("userId" IS NULL AND "guestId" IS NOT NULL))
                AND ("comment" IS NULL OR char_length("comment") BETWEEN 1 AND 2000)
                AND left("answers"::text, 1) = '['
                """));
        });

        UseDomainColumnNames(modelBuilder);
    }

    private static void UseDomainColumnNames(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (entityType.IsMappedToJson())
            {
                foreach (var property in entityType.GetProperties().Where(property => !property.IsPrimaryKey()))
                {
                    property.SetJsonPropertyName(JsonNamingPolicy.CamelCase.ConvertName(property.Name));
                }

                continue;
            }

            if (entityType.ClrType is { IsGenericType: false })
            {
                entityType.SetTableName(entityType.ClrType.Name);
            }

            foreach (var property in entityType.GetProperties())
            {
                property.SetColumnName(JsonNamingPolicy.CamelCase.ConvertName(property.Name));
            }
        }
    }

    private void TouchUsers()
    {
        var now = time.GetUtcNow().UtcDateTime;
        foreach (var entry in ChangeTracker.Entries<User>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedAt == default)
                {
                    entry.Entity.CreatedAt = now;
                }

                entry.Entity.UpdatedAt = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }
    }
}

public class ClockedInDbContextFactory : IDesignTimeDbContextFactory<ClockedInDbContext>
{
    public ClockedInDbContext CreateDbContext(string[] args)
    {
        EfConnection.LoadEnvFile();
        var options = new DbContextOptionsBuilder<ClockedInDbContext>()
            .UseNpgsql(EfConnection.GetConnectionString(), EfConnection.MapEnums)
            .ConfigureWarnings(warnings => warnings.Ignore(RelationalEventId.PendingModelChangesWarning))
            .Options;
        return new ClockedInDbContext(options, TimeProvider.System);
    }
}
