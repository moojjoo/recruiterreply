namespace RecruiterReply.Models;

public class CompareOffersRequest
{
    public JobOffer OfferOne { get; set; } = new();
    public JobOffer OfferTwo { get; set; } = new();
}
