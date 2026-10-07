using RecruiterReply.Entities;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class CareerRulesEngineTests
{
    private static RecruiterFacts CompleteFacts() => new()
    {
        IsRecruiter = true,
        Title = "Senior .NET Engineer",
        Company = "Acme Staffing",
        EmploymentType = "c2c",
        RateMax = 95,
        RateUnit = "hour",
        WorkMode = "remote",
        DurationMonths = 12,
    };

    private static CareerProfileEntity Profile() => new()
    {
        MinC2CHourlyRate = 85,
        MinW2HourlyRate = 70,
        MinSalary = 160000,
        EmploymentTypes = ["c2c", "w2"],
        WorkModes = ["remote", "hybrid"],
        AllowedLocations = ["Charlotte"],
        MinContractMonths = 6,
    };

    [Fact]
    public void Evaluate_NonRecruiter_IsIgnored()
    {
        var decision = CareerRulesEngine.Evaluate(new RecruiterFacts { IsRecruiter = false }, Profile());
        Assert.Equal(TriageStates.Ignored, decision.State);
    }

    [Fact]
    public void Evaluate_CompleteFactsMeetingBar_IsQualified()
    {
        var decision = CareerRulesEngine.Evaluate(CompleteFacts(), Profile());
        Assert.Equal(TriageStates.Qualified, decision.State);
    }

    [Fact]
    public void Evaluate_MissingRate_NeedsInfo()
    {
        var facts = CompleteFacts();
        facts.RateMax = null;

        var decision = CareerRulesEngine.Evaluate(facts, Profile());

        Assert.Equal(TriageStates.NeedsInfo, decision.State);
        Assert.Equal([RecruiterFactFields.Rate], decision.MissingFields);
    }

    [Fact]
    public void Evaluate_WithoutProfile_UsesDefaultMustKnowFields()
    {
        var decision = CareerRulesEngine.Evaluate(new RecruiterFacts { IsRecruiter = true }, null);

        Assert.Equal(TriageStates.NeedsInfo, decision.State);
        Assert.Equal(RecruiterFactFields.Defaults, decision.MissingFields);
    }

    [Theory]
    [InlineData("c2c", 80, "hour")]
    [InlineData("w2", 65, "hour")]
    [InlineData("fte", 150000, "year")]
    [InlineData("fte", 70, "hour")]
    public void Evaluate_RateUnderFloor_IsBelowBar(string type, decimal rate, string unit)
    {
        var facts = CompleteFacts();
        facts.EmploymentType = type;
        facts.RateMax = rate;
        facts.RateUnit = unit;
        var profile = Profile();
        profile.EmploymentTypes = [];

        var decision = CareerRulesEngine.Evaluate(facts, profile);

        Assert.Equal(TriageStates.BelowBar, decision.State);
        Assert.Single(decision.Reasons);
    }

    [Fact]
    public void Evaluate_BelowBarWinsOverMissingInfo()
    {
        var facts = CompleteFacts();
        facts.EmploymentType = "1099";
        facts.WorkMode = null;

        var decision = CareerRulesEngine.Evaluate(facts, Profile());

        Assert.Equal(TriageStates.BelowBar, decision.State);
        Assert.Empty(decision.MissingFields);
    }

    [Fact]
    public void Evaluate_OnsiteOutsideAllowedLocations_IsBelowBar()
    {
        var facts = CompleteFacts();
        facts.WorkMode = "hybrid";
        facts.Location = "Austin, TX";

        var decision = CareerRulesEngine.Evaluate(facts, Profile());

        Assert.Equal(TriageStates.BelowBar, decision.State);
        Assert.Contains(decision.Reasons, r => r.Contains("Austin"));
    }

    [Fact]
    public void Evaluate_ShortContract_IsBelowBar()
    {
        var facts = CompleteFacts();
        facts.DurationMonths = 3;

        Assert.Equal(TriageStates.BelowBar, CareerRulesEngine.Evaluate(facts, Profile()).State);
    }

    [Fact]
    public void Evaluate_DealBreakerInEmailText_IsBelowBar()
    {
        var profile = Profile();
        profile.DealBreakerKeywords = ["security clearance"];

        var decision = CareerRulesEngine.Evaluate(CompleteFacts(), profile, "Must hold an active Security Clearance");

        Assert.Equal(TriageStates.BelowBar, decision.State);
    }

    [Fact]
    public void Evaluate_BlockedCompany_IsBelowBar()
    {
        var profile = Profile();
        profile.BlockedCompanies = ["acme"];

        Assert.Equal(TriageStates.BelowBar, CareerRulesEngine.Evaluate(CompleteFacts(), profile).State);
    }

    [Fact]
    public void Evaluate_RemoteRole_DoesNotRequireLocation()
    {
        var profile = Profile();
        profile.MustKnowFields = [RecruiterFactFields.Location];

        Assert.Equal(TriageStates.Qualified, CareerRulesEngine.Evaluate(CompleteFacts(), profile).State);
    }

    [Fact]
    public void MergeWith_LaterFactsFillGapsWithoutErasingEarlierOnes()
    {
        var first = new RecruiterFacts { IsRecruiter = true, Title = "Engineer", WorkMode = "remote" };
        var reply = new RecruiterFacts { IsRecruiter = false, RateMax = 100, RateUnit = "hour" };

        var merged = first.MergeWith(reply);

        Assert.True(merged.IsRecruiter);
        Assert.Equal("Engineer", merged.Title);
        Assert.Equal("remote", merged.WorkMode);
        Assert.Equal(100, merged.RateMax);
    }
}
