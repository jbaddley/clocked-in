namespace ClockedIn.Api.Entities;

public enum TimeEntryMode
{
    Punch,
    Duration,
    Total,
}

public enum RateType
{
    Volunteer,
    Professional,
}

public enum AccessType
{
    Public,
    Private,
    Department,
    Organization,
}

public enum ProjectType
{
    Project,
    Event,
}

public enum RoleCode
{
    MEMBER,
    VOLUNTEER,
    ADMIN,
}

public enum MemberRelationship
{
    Parent,
    Child,
    Spouse,
    Sibling,
    Grandparent,
    Grandchild,
    Guardian,
    Dependent,
    Friend,
    Colleague,
    Associate,
}

public enum VolunteerNeedType
{
    Position,
    Task,
}

public enum FeedbackType
{
    Bug,
    Feature,
}

public enum FeedbackPriority
{
    Urgent,
    High,
    Medium,
    Low,
}

public enum FeedbackArea
{
    Dashboard,
    LogTime,
    Entries,
    Reports,
    Settings,
    Other,
}

public enum FeedbackStatus
{
    Pending,
    Acknowledged,
    Planned,
    InProgress,
    Resolved,
    Cancelled,
    CouldNotReproduce,
    Archived,
}

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public bool IsSuperAdmin { get; set; }
    public bool MustChangePassword { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public UserProfile? Profile { get; set; }
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
    public ICollection<OrganizationMembership> OrganizationMemberships { get; set; } = [];
    public ICollection<DepartmentMembership> DepartmentMemberships { get; set; } = [];
    public ICollection<Project> OwnedProjects { get; set; } = [];
    public ICollection<Project> EditableProjects { get; set; } = [];
    public ICollection<UserTimeEntry> TimeEntries { get; set; } = [];
    public ICollection<UserTimeEntry> TimeEntriesEntered { get; set; } = [];
    public ICollection<CollectiveTimeEntry> CollectiveTimeEntries { get; set; } = [];
    public ICollection<Invitation> InvitationsSent { get; set; } = [];
    public ICollection<PasswordResetCode> PasswordResetCodes { get; set; } = [];
    public ICollection<Feedback> Feedback { get; set; } = [];
    public ICollection<FeedbackAction> FeedbackActionsTaken { get; set; } = [];
    public ICollection<OrganizationApiKey> OrganizationApiKeysCreated { get; set; } = [];
    public ICollection<PlatformApiKey> PlatformApiKeysCreated { get; set; } = [];
    public ICollection<VolunteerNeed> VolunteerNeedsCreated { get; set; } = [];
    public ICollection<VolunteerSignup> VolunteerSignups { get; set; } = [];
    public ICollection<Guest> Guests { get; set; } = [];
}

public class UserProfile
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    // Description of the user in Markdown format
    public string? Description { get; set; }
    public string Timezone { get; set; } = "UTC";
    public string? Phone { get; set; }
    public string? ZipCode { get; set; }
    public string? Notes { get; set; }
    public string? MemberNumber { get; set; }

    public User User { get; set; } = null!;
}

public class Role
{
    public static readonly Guid MemberId = Guid.Parse("11111111-1111-4111-8111-111111111111");
    public static readonly Guid VolunteerId = Guid.Parse("33333333-3333-4333-8333-333333333333");
    public static readonly Guid AdminId = Guid.Parse("22222222-2222-4222-8222-222222222222");

    public static Guid IdOf(RoleCode code) => code switch
    {
        RoleCode.ADMIN => AdminId,
        RoleCode.VOLUNTEER => VolunteerId,
        _ => MemberId,
    };

    public Guid Id { get; set; }
    public RoleCode Code { get; set; }
    public string Name { get; set; } = null!;

    public ICollection<OrganizationMembership> OrganizationMemberships { get; set; } = [];
    public ICollection<DepartmentMembership> DepartmentMemberships { get; set; } = [];
    public ICollection<Invitation> Invitations { get; set; } = [];
}

public class EntityLabels
{
    public string Organization { get; set; } = "Organization";
    public string Project { get; set; } = "Project";
    public string Department { get; set; } = "Department";
    public string TaskCategory { get; set; } = "Task category";
}

public class OrganizationPreferences
{
    public bool AllowTimeEntryEditing { get; set; }
    public bool AllowVolunteersToAddVolunteers { get; set; }
    public EntityLabels EntityLabels { get; set; } = new();
    public List<Guid> FeedbackNotifyUserIds { get; set; } = [];
}

public class Organization
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    // Organization about information in Markdown format
    public string? Description { get; set; }
    public string? WebsiteUrl { get; set; }
    public RateType DefaultRateType { get; set; } = RateType.Volunteer;
    public OrganizationPreferences Preferences { get; set; } = new();
    public Guid ThemeId { get; set; } = Theme.ClockedInId;
    public string? WordmarkUrl { get; set; }
    public string? WordmarkOnLightUrl { get; set; }
    public string? MarkUrl { get; set; }
    public string? AccentImageUrl { get; set; }

    public Theme Theme { get; set; } = null!;
    public ICollection<Theme> Themes { get; set; } = [];
    public ICollection<HourlyRate> HourlyRates { get; set; } = [];
    public ICollection<OrganizationMembership> Memberships { get; set; } = [];
    public ICollection<Department> Departments { get; set; } = [];
    public ICollection<Tag> Tags { get; set; } = [];
    public ICollection<TaskCategory> TaskCategories { get; set; } = [];
    public ICollection<Project> Projects { get; set; } = [];
    public ICollection<UserTimeEntry> TimeEntries { get; set; } = [];
    public ICollection<CollectiveTimeEntry> CollectiveTimeEntries { get; set; } = [];
    public ICollection<Invitation> Invitations { get; set; } = [];
    public ICollection<Feedback> Feedback { get; set; } = [];
    public ICollection<OrganizationApiKey> ApiKeys { get; set; } = [];
    public ICollection<MemberConnection> Connections { get; set; } = [];
    public ICollection<Report> Reports { get; set; } = [];
    public ICollection<VolunteerNeed> VolunteerNeeds { get; set; } = [];
}

public class Report
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = null!;
    public bool IsDefault { get; set; }
    public string Layout { get; set; } = """{"version":1,"cards":[]}""";
    public string Filters { get; set; } = "{}";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Organization Organization { get; set; } = null!;
}

public class MemberConnection
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid UserAId { get; set; }
    public Guid UserBId { get; set; }
    public MemberRelationship Relationship { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Organization Organization { get; set; } = null!;
    public User UserA { get; set; } = null!;
    public User UserB { get; set; } = null!;
    public User CreatedBy { get; set; } = null!;
}

public class HourlyRate
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public RateType Type { get; set; }
    public string Name { get; set; } = null!;
    public decimal PerHourRate { get; set; }
    public bool IsDefault { get; set; }
    public bool IsArchived { get; set; }
    public string? Source { get; set; }

    public Organization Organization { get; set; } = null!;
    public ICollection<UserTimeEntry> UserTimeEntries { get; set; } = [];
    public ICollection<CollectiveTimeEntry> CollectiveTimeEntries { get; set; } = [];
}

public class OrganizationMembership
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid RoleId { get; set; }
    public RateType RateType { get; set; } = RateType.Volunteer;
    public decimal? ProfessionalBillingRate { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid? PrimaryDepartmentId { get; set; }
    public DateTime JoinedAt { get; set; }

    public User User { get; set; } = null!;
    public Organization Organization { get; set; } = null!;
    public Role Role { get; set; } = null!;
    public Department? PrimaryDepartment { get; set; }
    // Title of the user for this organization
    public string? OrgUserTitle { get; set; }
    // Description of the user for this organization in Markdown format
    public string? OrgUserDescription { get; set; }
}

public class Theme
{
    public static readonly Guid ClockedInId = Guid.Parse("44444444-4444-4444-8444-444444444441");
    public static readonly Guid HarborId = Guid.Parse("44444444-4444-4444-8444-444444444442");
    public static readonly Guid AtelierId = Guid.Parse("44444444-4444-4444-8444-444444444443");
    public static readonly Guid EvergreenId = Guid.Parse("44444444-4444-4444-8444-444444444444");
    public static readonly Guid OrchidId = Guid.Parse("44444444-4444-4444-8444-444444444445");
    public static readonly Guid OkabeItoId = Guid.Parse("44444444-4444-4444-8444-444444444446");
    public static readonly Guid TolBrightId = Guid.Parse("44444444-4444-4444-8444-444444444447");

    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public Guid? OrganizationId { get; set; }
    public string Primary { get; set; } = null!;
    public string PrimaryForeground { get; set; } = null!;
    public string Highlight { get; set; } = null!;
    public string Accent { get; set; } = null!;
    public string Success { get; set; } = null!;
    public string Surface { get; set; } = null!;
    public string SurfaceForeground { get; set; } = null!;
    public string Foreground { get; set; } = null!;
    public string ChartColor { get; set; } = null!;
    public string HeadingFont { get; set; } = null!;
    public string BodyFont { get; set; } = null!;
    public string CategoricalPalette { get; set; } = "[]";
    public string SequentialPalette { get; set; } = "[]";
    public string DivergingPalette { get; set; } = "[]";

    public Organization? Organization { get; set; }
    public ICollection<Organization> AssignedOrganizations { get; set; } = [];
}

public class Department
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = null!;

    public Organization Organization { get; set; } = null!;
    public ICollection<OrganizationMembership> PrimaryMemberships { get; set; } = [];
    public ICollection<DepartmentMembership> Memberships { get; set; } = [];
    public ICollection<Project> Projects { get; set; } = [];
    public ICollection<UserTimeEntry> TimeEntries { get; set; } = [];
    public ICollection<CollectiveTimeEntry> CollectiveTimeEntries { get; set; } = [];
    public ICollection<Invitation> Invitations { get; set; } = [];
    public ICollection<VolunteerNeed> VolunteerNeeds { get; set; } = [];
}

public class DepartmentMembership
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid DepartmentId { get; set; }
    public Guid RoleId { get; set; }
    public DateTime JoinedAt { get; set; }

    public User User { get; set; } = null!;
    public Department Department { get; set; } = null!;
    public Role Role { get; set; } = null!;
}

public class Tag
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = null!;

    public Organization Organization { get; set; } = null!;
    public ICollection<UserTimeEntry> UserTimeEntries { get; set; } = [];
    public ICollection<CollectiveTimeEntry> CollectiveTimeEntries { get; set; } = [];
}

public class TaskCategory
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = null!;

    public Organization Organization { get; set; } = null!;
    public ICollection<UserTimeEntry> UserTimeEntries { get; set; } = [];
    public ICollection<CollectiveTimeEntry> CollectiveTimeEntries { get; set; } = [];
    public ICollection<VolunteerNeed> VolunteerNeeds { get; set; } = [];
}

public class Project
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid? DepartmentId { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public AccessType AccessType { get; set; }
    public ProjectType ProjectType { get; set; } = ProjectType.Project;
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public bool IsActive { get; set; } = true;

    public Organization Organization { get; set; } = null!;
    public Department? Department { get; set; }
    public User Owner { get; set; } = null!;
    public ICollection<User> Editors { get; set; } = [];
    public ICollection<UserTimeEntry> UserTimeEntries { get; set; } = [];
    public ICollection<CollectiveTimeEntry> CollectiveTimeEntries { get; set; } = [];
    public ICollection<VolunteerNeed> VolunteerNeeds { get; set; } = [];
}

public class VolunteerNeed
{
    public const string EmptyQuestions = """{"version":1,"items":[]}""";

    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string PublicToken { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public VolunteerNeedType Type { get; set; }
    public int CountNeeded { get; set; }
    public int CountVetted { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public DateTime? RequiredBy { get; set; }
    public bool AllowPublic { get; set; }
    public bool RequireVetting { get; set; }
    public string Questions { get; set; } = EmptyQuestions;
    public Guid? ProjectId { get; set; }
    public Guid? TaskCategoryId { get; set; }
    public Guid? DepartmentId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Organization Organization { get; set; } = null!;
    public User CreatedBy { get; set; } = null!;
    public Project? Project { get; set; }
    public TaskCategory? TaskCategory { get; set; }
    public Department? Department { get; set; }
    public ICollection<VolunteerSignup> Signups { get; set; } = [];
}

public class Guest
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public Guid? UserId { get; set; }

    public User? User { get; set; }
    public ICollection<VolunteerSignup> Signups { get; set; } = [];
}

public class VolunteerSignup
{
    public const string EmptyAnswers = "[]";

    public Guid Id { get; set; }
    public Guid VolunteerNeedId { get; set; }
    public Guid? UserId { get; set; }
    public Guid? GuestId { get; set; }
    public string? Comment { get; set; }
    public string Answers { get; set; } = EmptyAnswers;
    public bool Passed { get; set; }
    public bool Vetted { get; set; }
    public DateTime CreatedAt { get; set; }

    public VolunteerNeed VolunteerNeed { get; set; } = null!;
    public User? User { get; set; }
    public Guest? Guest { get; set; }
}

public class UserTimeEntry
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid EnteredByUserId { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid? DepartmentId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid TaskCategoryId { get; set; }
    public Guid? HourlyRateId { get; set; }
    public TimeEntryMode Mode { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public int? DurationMinutes { get; set; }
    public DateOnly OccurredOn { get; set; }
    public string? Description { get; set; }
    public decimal HourlyRate { get; set; }
    public decimal? InKindValue { get; set; }
    public string? SourceRef { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public User EnteredBy { get; set; } = null!;
    public Organization Organization { get; set; } = null!;
    public Department? Department { get; set; }
    public Project Project { get; set; } = null!;
    public TaskCategory TaskCategory { get; set; } = null!;
    public HourlyRate? Rate { get; set; }
    public ICollection<Tag> Tags { get; set; } = [];
}

public class CollectiveTimeEntry
{
    public Guid Id { get; set; }
    public Guid RecordedByUserId { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid? DepartmentId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid TaskCategoryId { get; set; }
    public Guid? HourlyRateId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime EndedAt { get; set; }
    public int ParticipantCount { get; set; }
    public string? Description { get; set; }
    public decimal HourlyRate { get; set; }
    public decimal InKindValue { get; set; }
    public DateTime CreatedAt { get; set; }

    public User RecordedBy { get; set; } = null!;
    public Organization Organization { get; set; } = null!;
    public Department? Department { get; set; }
    public Project Project { get; set; } = null!;
    public TaskCategory TaskCategory { get; set; } = null!;
    public HourlyRate? Rate { get; set; }
    public ICollection<Tag> Tags { get; set; } = [];
}

public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public User User { get; set; } = null!;
}

public class OrganizationApiKey
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = null!;
    public string Prefix { get; set; } = null!;
    public string KeyHash { get; set; } = null!;
    public string Scopes { get; set; } = null!;
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public Organization Organization { get; set; } = null!;
    public User CreatedBy { get; set; } = null!;
}

public class PlatformApiKey
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Prefix { get; set; } = null!;
    public string KeyHash { get; set; } = null!;
    public string Scopes { get; set; } = null!;
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public User CreatedBy { get; set; } = null!;
}

public class Invitation
{
    public Guid Id { get; set; }
    public string Email { get; set; } = null!;
    public Guid OrganizationId { get; set; }
    public Guid? DepartmentId { get; set; }
    public Guid RoleId { get; set; }
    public string CodeHash { get; set; } = null!;
    public Guid InvitedByUserId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public Organization Organization { get; set; } = null!;
    public Department? Department { get; set; }
    public Role Role { get; set; } = null!;
    public User InvitedBy { get; set; } = null!;
}

public class PasswordResetCode
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string CodeHash { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
}

public class Feedback
{
    public static readonly FeedbackStatus[] ActiveStatuses =
    [
        FeedbackStatus.Pending,
        FeedbackStatus.Acknowledged,
        FeedbackStatus.Planned,
        FeedbackStatus.InProgress,
    ];

    public static readonly FeedbackStatus[] CompletedStatuses =
    [
        FeedbackStatus.Resolved,
        FeedbackStatus.Cancelled,
        FeedbackStatus.CouldNotReproduce,
    ];

    public static bool IsActive(FeedbackStatus status) => ActiveStatuses.Contains(status);

    public static bool IsCompleted(FeedbackStatus status) => CompletedStatuses.Contains(status);

    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? OrganizationId { get; set; }
    public FeedbackType Type { get; set; }
    public FeedbackPriority Priority { get; set; }
    public FeedbackArea Area { get; set; }
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public List<string> ScreenshotUrls { get; set; } = [];
    public FeedbackStatus Status { get; set; } = FeedbackStatus.Pending;
    public int? GithubIssueNumber { get; set; }
    public string? TicketUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public Organization? Organization { get; set; }
    public ICollection<FeedbackAction> Actions { get; set; } = [];
}

public class FeedbackAction
{
    public Guid Id { get; set; }
    public Guid FeedbackId { get; set; }
    public FeedbackStatus PreviousStatus { get; set; }
    public FeedbackStatus UpdatedStatus { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string Description { get; set; } = null!;
    public Guid TakenByUserId { get; set; }
    public string? TicketUrl { get; set; }

    public Feedback Feedback { get; set; } = null!;
    public User TakenBy { get; set; } = null!;
}
