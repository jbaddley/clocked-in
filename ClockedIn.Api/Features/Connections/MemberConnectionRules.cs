using ClockedIn.Api.Entities;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Features.Connections;

public static class MemberConnectionRules
{
    public static MemberRelationship Inverse(MemberRelationship relationship) => relationship switch
    {
        MemberRelationship.Parent => MemberRelationship.Child,
        MemberRelationship.Child => MemberRelationship.Parent,
        MemberRelationship.Grandparent => MemberRelationship.Grandchild,
        MemberRelationship.Grandchild => MemberRelationship.Grandparent,
        MemberRelationship.Guardian => MemberRelationship.Dependent,
        MemberRelationship.Dependent => MemberRelationship.Guardian,
        _ => relationship,
    };

    public static MemberRelationship Parse(string value)
    {
        if (!Enum.TryParse<MemberRelationship>(value.Trim(), ignoreCase: false, out var relationship)
            || !Enum.IsDefined(relationship))
        {
            throw ApiException.Validation(
                "relationship must be Parent, Child, Spouse, Sibling, Grandparent, Grandchild, Guardian, Dependent, Friend, Colleague, or Associate.");
        }

        return relationship;
    }

    public static (Guid UserAId, Guid UserBId) Order(Guid left, Guid right) =>
        string.Compare(left.ToString("D"), right.ToString("D"), StringComparison.Ordinal) <= 0
            ? (left, right)
            : (right, left);

    public static (Guid UserAId, Guid UserBId, MemberRelationship Relationship) Canonical(
        Guid fromUserId,
        Guid toUserId,
        MemberRelationship toRelativeToFrom)
    {
        if (fromUserId == toUserId)
        {
            throw ApiException.Validation("A person cannot be connected to themselves.");
        }

        var (userAId, userBId) = Order(fromUserId, toUserId);
        var relationship = userAId == fromUserId ? toRelativeToFrom : Inverse(toRelativeToFrom);
        return (userAId, userBId, relationship);
    }
}
