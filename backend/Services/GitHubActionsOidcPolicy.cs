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
    public static string? RejectionReason(ClaimsPrincipal? principal, GitHubActionsOidcPolicyOptions options)
    {
        if (!options.Enabled) return "disabled";
        if (principal is null) return "missing_principal";

        foreach (var (claim, expected, reason) in new[]
        {
            ("iss", options.Issuer, "issuer_mismatch"),
            ("aud", options.Audience, "audience_mismatch"),
            ("repository", options.Repository, "repository_mismatch"),
            ("job_workflow_ref", options.WorkflowRef, "workflow_mismatch"),
            ("ref", options.Ref, "ref_mismatch"),
            ("environment", options.Environment, "environment_mismatch")
        })
        {
            if (principal.FindFirst(claim)?.Value != expected) return reason;
        }

        return null;
    }

    public static bool IsApproved(ClaimsPrincipal? principal, GitHubActionsOidcPolicyOptions options)
    {
        return RejectionReason(principal, options) is null;
    }
}
