using RecruiterReply.Models;

namespace RecruiterReply.Services;

public interface IComparisonService
{
    Task<CompareOffersResponse> CompareOffersAsync(CompareOffersRequest request, Guid userId);
}
