using System.Security.Claims;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public sealed class GitHubActionsOidcPolicyTests
{
    private static readonly GitHubActionsOidcPolicyOptions Options = new(
        true,
        "https://token.actions.githubusercontent.com",
        "recruiterreply-dev-smoke",
        "moojjoo/recruiterreply",
        "moojjoo/recruiterreply/.github/workflows/promote.yml@refs/heads/main",
        "refs/heads/main",
        "dev");

    [Fact]
    public void Approves_exact_workflow_identity()
    {
        var principal = Principal();
        Assert.True(GitHubActionsOidcPolicy.IsApproved(principal, Options));
    }

    [Theory]
    [InlineData("repository", "attacker/repo")]
    [InlineData("job_workflow_ref", "moojjoo/recruiterreply/.github/workflows/other.yml@refs/heads/main")]
    [InlineData("ref", "refs/heads/feature/test")]
    [InlineData("environment", "prod")]
    [InlineData("aud", "other-audience")]
    [InlineData("iss", "https://issuer.example")]
    public void Rejects_mismatched_claim(string claim, string value)
    {
        var claims = Principal().Claims
            .Where(existing => existing.Type != claim)
            .Append(new Claim(claim, value));
        Assert.False(GitHubActionsOidcPolicy.IsApproved(new ClaimsPrincipal(new ClaimsIdentity(claims)), Options));
    }

    [Fact]
    public void Disabled_policy_rejects_even_valid_identity()
    {
        Assert.False(GitHubActionsOidcPolicy.IsApproved(Principal(), Options with {Enabled = false}));
    }

    private static ClaimsPrincipal Principal() => new(new ClaimsIdentity([
        new Claim("iss", Options.Issuer),
        new Claim("aud", Options.Audience),
        new Claim("repository", Options.Repository),
        new Claim("job_workflow_ref", Options.WorkflowRef),
        new Claim("environment", Options.Environment)
    ], "GitHubActionsSmoke"));
}
