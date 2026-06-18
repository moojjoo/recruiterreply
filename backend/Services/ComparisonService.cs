using RecruiterReply.Models;
using System.Text.Json;
using RecruiterReply.Data;
using RecruiterReply.Entities;

namespace RecruiterReply.Services;

public class ComparisonService : IComparisonService
{
    private readonly IOpenAIService _openAIService;
    private readonly ILogger<ComparisonService> _logger;
    private readonly RecruiterReplyDbContext _dbContext;
    private readonly IDefaultUserService _defaultUserService;

    public ComparisonService(
        IOpenAIService openAIService,
        ILogger<ComparisonService> logger,
        RecruiterReplyDbContext dbContext,
        IDefaultUserService defaultUserService)
    {
        _openAIService = openAIService;
        _logger = logger;
        _dbContext = dbContext;
        _defaultUserService = defaultUserService;
    }

    public async Task<CompareOffersResponse> CompareOffersAsync(CompareOffersRequest request)
    {
        if (request.OfferOne == null || request.OfferTwo == null)
        {
            throw new ArgumentException("Both offers are required");
        }

        try
        {
            var userId = await _defaultUserService.GetOrCreateDefaultUserIdAsync();
            var offerOneJson = JsonSerializer.Serialize(request.OfferOne);
            var offerTwoJson = JsonSerializer.Serialize(request.OfferTwo);

            var comparison = new OfferComparisonEntity
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Title = $"{request.OfferOne.Company} vs {request.OfferTwo.Company}",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _dbContext.OfferComparisons.Add(comparison);

            _dbContext.ComparisonItems.AddRange(
                MapOffer(comparison.Id, request.OfferOne),
                MapOffer(comparison.Id, request.OfferTwo));

            await _dbContext.SaveChangesAsync();

            var result = await _openAIService.CompareOffersAsync(offerOneJson, offerTwoJson);

            var response = JsonSerializer.Deserialize<CompareOffersResponse>(result);
            if (response == null)
            {
                throw new InvalidOperationException("Failed to deserialize AI response");
            }

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error comparing offers");
            throw;
        }
    }

    private static ComparisonItemEntity MapOffer(Guid comparisonId, JobOffer offer)
    {
        return new ComparisonItemEntity
        {
            Id = Guid.NewGuid(),
            ComparisonId = comparisonId,
            CompanyName = offer.Company,
            PositionTitle = offer.JobTitle,
            Salary = offer.Salary,
            HourlyRate = offer.HourlyRate,
            ContractLengthMonths = offer.ContractLengthMonths,
            CommuteMinutes = offer.CommuteTimeMinutes,
            RemoteFlexibility = offer.WorkArrangement,
            Notes = offer.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}
