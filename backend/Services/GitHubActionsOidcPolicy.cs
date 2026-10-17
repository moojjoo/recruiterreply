using System.Security.Claims;

namespace RecruiterReply.Services;

public sealed record GitHubActionsOidcPolicyOptions(
    bool Enabled,
    string Issuer,
    string Audience,
    string Repository,
    string WorkflowRef,
    string Ref,
    string Environment);

public static class GitHubActionsOidcPolicy
{
    public static bool IsApproved(ClaimsPrincipal? principal, GitHubActionsOidcPolicyOptions options)
    {
        if (!options.Enabled || principal is null)
        {
            return false;
        }

        return principal.FindFirst("iss")?.Value == options.Issuer
            && principal.FindFirst("aud")?.Value == options.Audience
            && principal.FindFirst("repository")?.Value == options.Repository
            && principal.FindFirst("job_workflow_ref")?.Value == options.WorkflowRef
            && principal.FindFirst("ref")?.Value == options.Ref
            && principal.FindFirst("environment")?.Value == options.Environment;
    }
}
