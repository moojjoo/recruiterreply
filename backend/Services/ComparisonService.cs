using RecruiterReply.Models;
using System.Text.Json;

namespace RecruiterReply.Services;

public class ComparisonService : IComparisonService
{
    private readonly IOpenAIService _openAIService;
    private readonly ILogger<ComparisonService> _logger;

    public ComparisonService(IOpenAIService openAIService, ILogger<ComparisonService> logger)
    {
        _openAIService = openAIService;
        _logger = logger;
    }

    public async Task<CompareOffersResponse> CompareOffersAsync(CompareOffersRequest request)
    {
        if (request.OfferOne == null || request.OfferTwo == null)
        {
            throw new ArgumentException("Both offers are required");
        }

        try
        {
            var offerOneJson = JsonSerializer.Serialize(request.OfferOne);
            var offerTwoJson = JsonSerializer.Serialize(request.OfferTwo);

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
}
