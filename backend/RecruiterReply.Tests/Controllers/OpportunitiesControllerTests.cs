using Microsoft.AspNetCore.Mvc;
using RecruiterReply.Controllers;
using RecruiterReply.Entities;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Controllers;

public class OpportunitiesControllerTests
{
    private readonly RecruiterReply.Data.RecruiterReplyDbContext _db = TestDb.Create();
    private readonly OpportunitiesController _sut;
    private readonly Guid _userId = Guid.NewGuid();

    public OpportunitiesControllerTests()
    {
        _sut = new OpportunitiesController(_db);
        _sut.SetUser(_userId);
    }

    private async Task<OpportunityEntity> SeedOpportunity(Guid userId, string status = "lead")
    {
        var opportunity = new OpportunityEntity
        {
            Id = Guid.NewGuid(), UserId = userId, CompanyName = "Acme", PositionTitle = "Engineer",
            Status = status, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        _db.Opportunities.Add(opportunity);
        await _db.SaveChangesAsync();
        return opportunity;
    }

    [Fact]
    public async Task GetOpportunities_ReturnsOnlyTheAuthenticatedUsersOpportunities()
    {
        await SeedOpportunity(_userId);
        await SeedOpportunity(Guid.NewGuid());

        var result = await _sut.GetOpportunities(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var list = Assert.IsAssignableFrom<List<OpportunityEntity>>(ok.Value);
        Assert.Single(list);
    }

    [Fact]
    public async Task GetOpportunity_WithAnotherUsersOpportunity_ReturnsNotFound()
    {
        var opportunity = await SeedOpportunity(Guid.NewGuid());

        var result = await _sut.GetOpportunity(opportunity.Id, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task CreateOpportunity_WithoutStatus_DefaultsToLead()
    {
        var request = new OpportunityEntity { CompanyName = "Acme", PositionTitle = "Engineer", Status = "" };

        var result = await _sut.CreateOpportunity(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var opportunity = Assert.IsType<OpportunityEntity>(created.Value);
        Assert.Equal("lead", opportunity.Status);
        Assert.Equal(_userId, opportunity.UserId);
    }

    [Fact]
    public async Task UpdateOpportunity_WithBlankStatus_KeepsExistingStatus()
    {
        var opportunity = await SeedOpportunity(_userId, status: "interviewing");

        var result = await _sut.UpdateOpportunity(
            opportunity.Id,
            new OpportunityEntity { CompanyName = "Acme", PositionTitle = "Engineer", Status = "" },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("interviewing", ((OpportunityEntity)ok.Value!).Status);
    }

    [Fact]
    public async Task UpdateOpportunity_WithAnotherUsersOpportunity_ReturnsNotFound()
    {
        var opportunity = await SeedOpportunity(Guid.NewGuid());

        var result = await _sut.UpdateOpportunity(opportunity.Id, new OpportunityEntity { CompanyName = "X", PositionTitle = "Y", Status = "lead" }, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task DeleteOpportunity_WithOwnOpportunity_RemovesIt()
    {
        var opportunity = await SeedOpportunity(_userId);

        var result = await _sut.DeleteOpportunity(opportunity.Id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(0, _db.Opportunities.Count());
    }

    [Fact]
    public async Task DeleteOpportunity_WithAnotherUsersOpportunity_ReturnsNotFound()
    {
        var opportunity = await SeedOpportunity(Guid.NewGuid());

        var result = await _sut.DeleteOpportunity(opportunity.Id, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
        Assert.Equal(1, _db.Opportunities.Count());
    }
}
