# RecruiterReply Backend API

ASP.NET CORE 10 Web API for RecruiterReply MVP

## 🎯 Quick Start

```bash
cd backend

# 1. Set OpenAI API key in appsettings.json
# Edit: appsettings.json
{
  "OpenAI": {
    "ApiKey": "sk-proj-YOUR_KEY"
  }
}

# 2. Run
dotnet restore
dotnet run
```

✅ Backend ready at: **http://localhost:5000**
📚 Swagger UI: **http://localhost:5000/swagger**

## 📋 Prerequisites

- .NET 10 SDK ([download](https://dotnet.microsoft.com/download/dotnet/10.0))
- OpenAI API key ([get one](https://platform.openai.com/api-keys))
- See [.env.example](../.env.example) for configuration options

## 🔐 Configuration

### Development

**Option 1: appsettings.json (Easiest)**

```json
{
  "OpenAI": {
    "ApiKey": "sk-proj-YOUR_KEY"
  }
}
```

**Option 2: Environment Variable**

```bash
# Windows
set OPENAI_API_KEY=sk-proj-YOUR_KEY
dotnet run

# Linux/Mac
export OPENAI_API_KEY=sk-proj-YOUR_KEY
dotnet run
```

**Option 3: User Secrets (Recommended)**

```bash
dotnet user-secrets init
dotnet user-secrets set "OpenAI:ApiKey" "sk-proj-YOUR_KEY"
dotnet run
```

### Production

Use cloud secrets manager:

```bash
# Azure App Service
# Settings → Configuration → Add: OPENAI_API_KEY

# Docker
docker run -e OPENAI_API_KEY=sk-... myapp

# AWS Lambda / ECS
# Set environment variables in service definition
```

See [backend/.env.example](../.env.example) for full configuration guide.

## 🏗️ Project Structure

```
backend/
├── Controllers/            # HTTP endpoints (3 files)
│   ├── AnalysisController.cs
│   ├── ReplyController.cs
│   └── ComparisonController.cs
├── Services/              # Business logic & OpenAI (8 files)
│   ├── IOpenAIService.cs
│   ├── OpenAIService.cs    # OpenAI integration
│   ├── IAnalysisService.cs
│   ├── AnalysisService.cs
│   ├── IReplyService.cs
│   ├── ReplyService.cs
│   ├── IComparisonService.cs
│   └── ComparisonService.cs
├── Models/                # Request/Response DTOs (7 files)
│   ├── AnalyzeMessageRequest/Response.cs
│   ├── GenerateReplyRequest/Response.cs
│   ├── JobOffer.cs
│   └── CompareOffersRequest/Response.cs
├── Program.cs             # DI, middleware, configuration
├── appsettings.json       # Settings (API key placeholder)
└── RecruiterReply.csproj
```

## 📡 API Endpoints

All endpoints are `POST` and return JSON. Full docs at: `http://localhost:5000/swagger`

| Endpoint                         | Purpose                     | Input                                 |
| -------------------------------- | --------------------------- | ------------------------------------- |
| `/api/analyze-recruiter-message` | Analyze recruiter email     | message, company?, title?             |
| `/api/generate-reply`            | Generate professional reply | type, message, minPay?, work?, notes? |
| `/api/compare-offers`            | Compare job offers          | offerOne, offerTwo                    |

### POST /api/analyze-recruiter-message

Analyze a recruiter message

**Request:**

```json
{
  "recruiterMessage": "Hi, we're hiring for...",
  "companyName": "Acme Corp",
  "jobTitle": "Senior Engineer"
}
```

**Response (200):**

```json
{
  "compensationMentioned": "$120k-140k + equity",
  "jobType": "W2, Full-time, Remote",
  "redFlags": ["Vague timeline", "No benefits mentioned"],
  "questionsToAsk": ["What's team size?", "Any equity?"],
  "suggestedResponse": "Thank you for reaching out...",
  "opportunityScore": 75
}
```

**Error (400/500):**

```json
{
  "error": "Message cannot be empty"
}
```

### POST /api/generate-reply

Generate a professional reply

**Request:**

```json
{
  "replyType": "interested",
  "recruiterMessage": "We're hiring...",
  "candidateMinimumPay": 120000,
  "preferredWorkArrangement": "remote",
  "notes": "Prefer established companies"
}
```

**Response (200):**

```json
{
  "reply": "Thank you for reaching out. I'm very interested...",
  "tone": "Enthusiastic"
}
```

**Reply Types:**
| Type | Tone | Use Case |
|------|------|----------|
| `interested` | Enthusiastic | Express strong interest |
| `request_pay_range` | Professional & Direct | Ask compensation details |
| `counteroffer` | Confident | Make a counteroffer |
| `decline` | Polite | Turn down opportunity |
| `followup` | Proactive | Follow up on previous conversation |

### POST /api/compare-offers

Compare two job offers

**Request:**

```json
{
  "offerOne": {
    "company": "BigTech",
    "jobTitle": "Senior Engineer",
    "salary": 150000,
    "compensationType": "W2",
    "contractLengthMonths": 12,
    "benefitsEstimate": 20000,
    "commuteTimeMinutes": 30,
    "workArrangement": "hybrid",
    "notes": "Established company"
  },
  "offerTwo": {
    "company": "StartupXYZ",
    "jobTitle": "Lead Engineer",
    "salary": 160000,
    "compensationType": "W2",
    "contractLengthMonths": 12,
    "benefitsEstimate": 5000,
    "commuteTimeMinutes": 0,
    "workArrangement": "remote",
    "notes": "Series A funded"
  }
}
```

**Response (200):**

```json
{
  "estimatedAnnualValueOne": 170000,
  "estimatedAnnualValueTwo": 165000,
  "prosOne": ["Established company", "Great benefits", "Team stability"],
  "prosTwo": ["Remote work", "Higher base salary", "Growth opportunity"],
  "consOne": ["30 min commute", "Slower moving"],
  "consTwo": ["Early stage", "Limited benefits", "Higher risk"],
  "riskLevelOne": "low",
  "riskLevelTwo": "high",
  "recommendation": "Offer One provides better stability...",
  "bestOffer": "Offer One"
}
```

## 🛠️ Build & Deploy

### Development

```bash
dotnet restore
dotnet run
```

### Release Build

```bash
dotnet publish -c Release
```

Output: `bin/Release/net10.0/publish/`

### Docker

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app
COPY . .
RUN dotnet publish -c Release -o out

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/out .
ENV ASPNETCORE_URLS=http://+:5000
EXPOSE 5000
ENTRYPOINT ["dotnet", "RecruiterReply.dll"]
```

```bash
docker build -t recruiterreply-api .
docker run -p 5000:5000 -e OPENAI_API_KEY=sk-... recruiterreply-api
```

## 🔒 Security Features

✅ **Error Handling**: All endpoints have try-catch with logging
✅ **Input Validation**: Message and offer data validated
✅ **Logging**: All operations logged (errors especially)
✅ **CORS**: Configured for frontend origins
✅ **API Key**: Never exposed in responses
✅ **Type Safety**: Full type validation via DTOs

## 🐛 Troubleshooting

### API Key Issues

```
Error: "OpenAI:ApiKey is not configured"
Solution: Set API key in appsettings.json or OPENAI_API_KEY env var
```

```
Error: "Invalid API key"
Solution: Check key at https://platform.openai.com/api-keys
Check account has available credits
```

### CORS Issues

```
Error: "CORS policy: No 'Access-Control-Allow-Origin' header"
Solution: Ensure frontend is on http://localhost:3000 or http://localhost:5173
(configured in Program.cs)
```

### Connection Issues

```
Error: Backend not responding
Solution:
1. Check backend is running: http://localhost:5000/swagger
2. Check port 5000 is not in use: netstat -an | grep 5000
3. Change port in Program.cs if needed
```

## 📊 Endpoints Summary

| Method | Path                             | Handler                                    |
| ------ | -------------------------------- | ------------------------------------------ |
| POST   | `/api/analyze-recruiter-message` | AnalysisController.AnalyzeRecruiterMessage |
| POST   | `/api/generate-reply`            | ReplyController.GenerateReply              |
| POST   | `/api/compare-offers`            | ComparisonController.CompareOffers         |
| GET    | `/swagger`                       | Swagger UI (development only)              |

## 🧪 Testing Endpoints

### Using curl

```bash
# Test message analysis
curl -X POST http://localhost:5000/api/analyze-recruiter-message \
  -H "Content-Type: application/json" \
  -d '{
    "recruiterMessage": "Hi, we have an opportunity...",
    "companyName": "Test Corp",
    "jobTitle": "Engineer"
  }'

# Test reply generation
curl -X POST http://localhost:5000/api/generate-reply \
  -H "Content-Type: application/json" \
  -d '{
    "replyType": "interested",
    "recruiterMessage": "Hi, we have an opportunity...",
    "candidateMinimumPay": 100000
  }'
```

### Using Swagger UI

Navigate to: http://localhost:5000/swagger

- Click endpoint
- Click "Try it out"
- Enter request body
- Click "Execute"

## 📈 Performance & Costs

**OpenAI API Calls:**

- Each request calls GPT-4-Turbo
- Average cost: $0.02-0.07 per request
- Monitor usage: https://platform.openai.com/account/usage

**Optimization Tips:**

- Use user feedback to improve prompts
- Cache common responses
- Implement request throttling for high volume
- Monitor response times in logs

## 🚀 Deployment Platforms

### Azure App Service

```bash
dotnet publish -c Release
# Deploy publish folder to App Service
# Set OPENAI_API_KEY in Configuration
```

### AWS Elastic Beanstalk

```bash
dotnet publish -c Release
eb create recruiterreply-api
eb deploy
# Set OPENAI_API_KEY in Environment variables
```

### Heroku

```bash
heroku create recruiterreply-api
heroku config:set OPENAI_API_KEY=sk-...
git push heroku main
```

## 📝 Dependencies

- `OpenAI` v1.25.0 - GPT-4 integration
- `Npgsql` 7.0.4 - PostgreSQL (for future persistence)
- `Swashbuckle` 6.4.6 - Swagger/OpenAPI documentation
- Standard .NET 10 libraries

## 📚 Additional Resources

- [OpenAI API Docs](https://platform.openai.com/docs/api-reference)
- [ASP.NET CORE 10 Docs](https://learn.microsoft.com/en-us/aspnet/core/)
- [.NET 10 Migration Guide](https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-10)

## Development

### Run with hot reload

```bash
dotnet watch run
```

### View Swagger docs

```
http://localhost:5000/swagger
```

## Notes

- No database needed for MVP (stateless API)
- Authentication not implemented
- OpenAI API calls are synchronous
- Consider adding caching in production
