using ClockedIn.Api.Entities;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Security;

public sealed class CurrentUser
{
    private User? _user;

    public User User => _user ?? throw ApiException.Unauthorized();

    public Guid Id => User.Id;

    public bool IsSuperAdmin => User.IsSuperAdmin;

    internal void Set(User user) => _user = user;
}
