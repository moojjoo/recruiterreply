using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace RecruiterReply.Services;

public class OpenAIService : IOpenAIService
{
    private readonly string _apiKey;
    private readonly ILogger<OpenAIService> _logger;
    private readonly HttpClient _httpClient;
    private const string OpenAIBaseUrl = "https://api.openai.com/v1";
    private const string Model = "gpt-4-turbo";

    public OpenAIService(string apiKey, ILogger<OpenAIService> logger)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new ArgumentException("OpenAI API key cannot be empty", nameof(apiKey));
        
        _apiKey = apiKey;
        _logger = logger;
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
    }

    public async Task<string> AnalyzeRecruiterMessageAsync(string message, string? companyName, string? jobTitle)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(message))
                throw new ArgumentException("Message cannot be empty", nameof(message));

            var prompt = BuildAnalysisPrompt(message, companyName, jobTitle);
            var response = await CallOpenAIAsync(prompt);
            _logger.LogInformation("Message analysis completed successfully");
            return response;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "OpenAI API error during message analysis");
            throw new InvalidOperationException("Failed to analyze message. Please try again.", ex);
        }
    }

    public async Task<string> GenerateReplyAsync(string replyType, string message, decimal? minPay, string? workArrangement, string? notes)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(message) || string.IsNullOrWhiteSpace(replyType))
                throw new ArgumentException("Message and reply type cannot be empty");

            var prompt = BuildReplyPrompt(replyType, message, minPay, workArrangement, notes);
            var response = await CallOpenAIAsync(prompt);
            _logger.LogInformation("Reply generation completed successfully");
            return response;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "OpenAI API error during reply generation");
            throw new InvalidOperationException("Failed to generate reply. Please try again.", ex);
        }
    }

    public async Task<string> CompareOffersAsync(string offerOneJson, string offerTwoJson)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(offerOneJson) || string.IsNullOrWhiteSpace(offerTwoJson))
                throw new ArgumentException("Both offers are required");

            var prompt = BuildComparisonPrompt(offerOneJson, offerTwoJson);
            var response = await CallOpenAIAsync(prompt);
            _logger.LogInformation("Offer comparison completed successfully");
            return response;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "OpenAI API error during offer comparison");
            throw new InvalidOperationException("Failed to compare offers. Please try again.", ex);
        }
    }

    private async Task<string> CallOpenAIAsync(string prompt)
    {
        var request = new OpenAIChatRequest
        {
            Model = Model,
            Messages = new[]
            {
                new OpenAIMessage { Role = "user", Content = prompt }
            },
            Temperature = 0.7,
            MaxTokens = 2000
        };

        var response = await _httpClient.PostAsJsonAsync($"{OpenAIBaseUrl}/chat/completions", request);
        response.EnsureSuccessStatusCode();
        
        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<OpenAIChatResponse>(content);
        return result?.Choices[0].Message.Content ?? throw new InvalidOperationException("Empty response from OpenAI");
    }

    private static string BuildAnalysisPrompt(string message, string? companyName, string? jobTitle)
    {
        return $@"Analyze this recruiter message and respond with ONLY valid JSON (no markdown):
{{
  ""compensationMentioned"": ""compensation or 'not mentioned'"",
  ""jobType"": ""job type (W2/C2C/contract/etc)"",
  ""redFlags"": [""flag1"", ""flag2""],
  ""questionsToAsk"": [""question1"", ""question2""],
  ""suggestedResponse"": ""brief response suggestion"",
  ""opportunityScore"": 0-100
}}

Message: {message}
{(string.IsNullOrEmpty(companyName) ? "" : $"Company: {companyName}")}
{(string.IsNullOrEmpty(jobTitle) ? "" : $"Job: {jobTitle}")}";
    }

    private static string BuildReplyPrompt(string replyType, string message, decimal? minPay, string? workArrangement, string? notes)
    {
        var tone = replyType switch
        {
            "interested" => "enthusiastic",
            "request_pay_range" => "professional and direct",
            "counteroffer" => "confident",
            "decline" => "polite",
            "followup" => "proactive",
            _ => "professional"
        };

        return $@"Write a professional email reply ({tone} tone). Return ONLY the email body:

Type: {replyType}
{(minPay.HasValue ? $"Min Pay: ${minPay}" : "")}
{(string.IsNullOrEmpty(workArrangement) ? "" : $"Work: {workArrangement}")}
{(string.IsNullOrEmpty(notes) ? "" : $"Notes: {notes}")}

Original message: {message}";
    }

    private static string BuildComparisonPrompt(string offerOneJson, string offerTwoJson)
    {
        return $@"Compare these job offers and respond with ONLY valid JSON (no markdown):
{{
  ""estimatedAnnualValueOne"": 0,
  ""estimatedAnnualValueTwo"": 0,
  ""prosOne"": [],
  ""prosTwo"": [],
  ""consOne"": [],
  ""consTwo"": [],
  ""riskLevelOne"": ""low/medium/high"",
  ""riskLevelTwo"": ""low/medium/high"",
  ""recommendation"": ""why to choose one"",
  ""bestOffer"": ""Offer One or Offer Two""
}}

Offer One: {offerOneJson}
Offer Two: {offerTwoJson}

Consider: salary, benefits, work arrangement, commute, quality of life.";
    }

    // OpenAI API DTOs
    private class OpenAIChatRequest
    {
        [JsonPropertyName("model")]
        public string Model { get; set; } = string.Empty;

        [JsonPropertyName("messages")]
        public OpenAIMessage[] Messages { get; set; } = Array.Empty<OpenAIMessage>();

        [JsonPropertyName("temperature")]
        public double Temperature { get; set; } = 0.7;

        [JsonPropertyName("max_tokens")]
        public int MaxTokens { get; set; } = 2000;
    }

    private class OpenAIMessage
    {
        [JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;
    }

    private class OpenAIChatResponse
    {
        [JsonPropertyName("choices")]
        public OpenAIChoice[] Choices { get; set; } = Array.Empty<OpenAIChoice>();
    }

    private class OpenAIChoice
    {
        [JsonPropertyName("message")]
        public OpenAIMessage Message { get; set; } = new();
    }
}
