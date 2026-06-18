# RecruiterReply MVP - AI-Powered Job Search Assistant

An intelligent AI-powered web application for job seekers to analyze recruiter messages, generate professional replies, and compare job offers.

## 🎯 Features

1. **AI Message Analyzer** 📊 - Get instant AI analysis of recruiter emails with red flags, compensation details, and opportunity scoring
2. **AI Reply Generator** ✉️ - Generate professional replies to recruiters with customizable tone and preferences  
3. **Job Offer Comparison** ⚖️ - Compare multiple job offers side-by-side with AI-powered recommendations

## 🏗️ Architecture

- **Backend**: ASP.NET CORE 10 (.NET) with OpenAI integration
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **API**: REST with Axios
- **AI Engine**: OpenAI GPT-4-Turbo

## 📁 Project Structure

```
recruiterreply/
├── backend/                    # ASP.NET CORE 10 API
│   ├── Controllers/
│   ├── Services/
│   ├── Models/
│   ├── RecruiterReply.csproj
│   ├── Program.cs
│   ├── appsettings.json
│   └── README.md
├── frontend/                   # React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   └── App.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
├── docs/                       # Documentation
└── README.md                   # This file
```

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: ASP.NET CORE 10 + C#
- **API**: RESTful with JSON
- **AI**: OpenAI API (GPT-4)
- **Build Tools**: Vite, npm

## 📋 Prerequisites

1. **Install .NET 10 SDK**
   - Download: https://dotnet.microsoft.com/download/dotnet/10.0
   - Verify: `dotnet --version`

2. **Install Node.js 18+**
   - Download: https://nodejs.org/
   - Verify: `node --version`

3. **Get OpenAI API Key**
   - Visit: https://platform.openai.com/api-keys
   - Create a new API key (format: `sk-proj-...`)

## 🚀 Quick Start (3 Steps)

### Step 1: Configure OpenAI API Key

Edit `backend/appsettings.json`:

```json
{
  "OpenAI": {
    "ApiKey": "sk-proj-YOUR_KEY_HERE"
  }
}
```

⚠️ **IMPORTANT**: This file is in `.gitignore` - never commit your real API key!

### Step 2: Start Backend Server

**Terminal #1:**
```bash
cd backend
dotnet restore
dotnet run
```

✅ Backend ready at: `http://localhost:5000`
📚 Swagger docs: `http://localhost:5000/swagger`

### Step 3: Start Frontend Server

**Terminal #2:**
```bash
cd frontend
npm install
npm run dev
```

✅ Frontend ready at: `http://localhost:5173`

Open your browser to: **http://localhost:5173**

## 🧪 Testing Each Feature

### Feature 1: Message Analyzer 📊

**Test Steps:**
1. Click "Analyze" in navigation
2. Paste this email:
```
Subject: Senior Engineer Opportunity - $140-160K

Hi there,

We're hiring a Senior Engineer at TechCorp. Remote role with:
- Base: $140,000-$160,000
- Bonus: 10-20%
- Equity: 0.1%-0.2%
- Full benefits, 25 days PTO
- $2,000/year learning budget

Can you start a conversation this week?

Best,
Jane
```
3. Click "Analyze Message"
4. Get: compensation, red flags, opportunity score (72/100), questions to ask

### Feature 2: Reply Generator ✉️

**Test Steps:**
1. Click "Reply" in navigation
2. Select: "Interested"
3. Paste the email from above
4. Add optional:
   - Minimum pay: `130000`
   - Work arrangement: `Remote`
5. Click "Generate Reply"
6. Get professional email response
7. Copy to clipboard

### Feature 3: Offer Comparison ⚖️

**Test Steps:**
1. Click "Compare" in navigation
2. **Offer 1**: 
   - Company: `TechCorp`, Title: `Senior Engineer`
   - Salary: `150000`, Benefits: `20000`
   - Commute: `0`, Work: `Remote`
3. **Offer 2**:
   - Company: `StartupXYZ`, Title: `Lead Engineer`
   - Salary: `160000`, Benefits: `5000`
   - Commute: `30`, Work: `Hybrid`
4. Click "Compare Offers"
## 🔐 Security & API Key Configuration

### How API Keys Work

✅ **Frontend**: NO API key stored or exposed
✅ **Backend**: API key in appsettings.json (gitignored)
✅ **Flow**: Frontend → Backend → OpenAI (secure)

### Configuration Options

**Option 1: appsettings.json (Easiest)**
```json
{
  "OpenAI": {
    "ApiKey": "sk-proj-YOUR_KEY"
  }
}
```

**Option 2: Environment Variable (Safer)**
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
cd backend
dotnet user-secrets init
dotnet user-secrets set "OpenAI:ApiKey" "sk-proj-YOUR_KEY"
dotnet run
```

### Production

- Use cloud secrets manager (Azure Key Vault, AWS Secrets Manager)
- Never commit API keys
- Rotate keys regularly
- Monitor usage: https://platform.openai.com/account/usage

## 📡 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/analyze-recruiter-message` | Analyze recruiter email |
| POST | `/api/generate-reply` | Generate reply |
| POST | `/api/compare-offers` | Compare job offers |

**Full API docs**: `http://localhost:5000/swagger`

### POST /api/analyze-recruiter-message
Analyze a recruiter message

**Request:**
```json
{
  "recruiterMessage": "Hi, we're interested in...",
  "companyName": "Acme Corp",
  "jobTitle": "Senior Engineer"
}
```

**Response:**
```json
{
  "compensationMentioned": "$120k-140k + equity",
  "jobType": "W2, Full-time, Remote",
  "redFlags": ["Vague timeline", "No benefits mentioned"],
  "questionsToAsk": ["What's the team size?", "Health insurance?"],
  "suggestedResponse": "Thanks for reaching out...",
  "opportunityScore": 72
}
```

### POST /api/generate-reply
Generate a reply to a recruiter

**Request:**
```json
{
  "replyType": "interested",
  "recruiterMessage": "Hi, are you interested...",
  "candidateMinimumPay": 120000,
  "preferredWorkArrangement": "remote",
  "notes": "Prefer startups"
}
```

**Response:**
```json
{
  "reply": "Thank you for reaching out...",
  "tone": "Enthusiastic"
}
```

### POST /api/compare-offers
Compare two job offers

**Request:**
```json
{
  "offerOne": {
    "company": "Company A",
    "jobTitle": "Senior Engineer",
    "salary": 150000,
    "compensationType": "W2",
    "contractLengthMonths": 12,
    "benefitsEstimate": 15000,
    "commuteTimeMinutes": 30,
    "workArrangement": "hybrid"
  },
  "offerTwo": {
    "company": "Company B",
    "jobTitle": "Lead Engineer",
    "salary": 160000,
    "compensationType": "W2",
    "contractLengthMonths": 12,
    "benefitsEstimate": 20000,
    "commuteTimeMinutes": 0,
    "workArrangement": "remote"
  }
}
```

**Response:**
```json
{
  "estimatedAnnualValueOne": 165000,
  "estimatedAnnualValueTwo": 180000,
  "prosOne": ["Established company", "Good benefits"],
  "prosTwo": ["Remote work", "Better compensation"],
  "consOne": ["Long commute"],
  "consTwo": ["Early-stage company"],
  "riskLevelOne": "low",
  "riskLevelTwo": "medium",
  "recommendation": "Company B offers higher...",
  "bestOffer": "Offer Two"
}
```

## 📚 File Structure Details

### Backend Files
- **Controllers/**: HTTP endpoints (AnalysisController, ReplyController, ComparisonController)
- **Services/**: Business logic (AnalysisService, ReplyService, ComparisonService, OpenAIService)
- **Models/**: Request/Response DTOs and domain models
- **Program.cs**: Application configuration and setup

### Frontend Files
- **components/**: Reusable React components
  - MessageAnalyzer, AnalysisResult
  - ReplyGenerator, ReplyResult
  - ComparisonTool, ComparisonResult
- **pages/**: Full page components
  - HomePage, AnalysisPage, ReplyPage, ComparisonPage
- **services/**: API client (api.ts)
- **types/**: TypeScript interfaces
- **App.tsx**: Main component with navigation

## 🧪 Testing

### Backend
```bash
cd backend
dotnet test
```

### Frontend
```bash
cd frontend
npm test
```

## 📦 Build for Production

### Backend
```bash
cd backend
dotnet publish -c Release
```

### Frontend
```bash
cd frontend
npm run build
```

Output in `frontend/dist/`

## 🐳 Docker

### Build Backend Image
```bash
cd backend
docker build -t recruiterreply-api .
docker run -p 5000:80 -e OPENAI_API_KEY=sk-... recruiterreply-api
```

### Build Frontend Image
```bash
cd frontend
docker build -t recruiterreply-web .
docker run -p 3000:3000 recruiterreply-web
```

## 📋 Notes

- **No Authentication**: This MVP doesn't include user authentication. All endpoints are public.
- **No Database**: The API is stateless and doesn't persist data. Each request is independent.
- **OpenAI Costs**: Using this app will incur OpenAI API costs. Monitor your usage!
- **CORS Enabled**: Frontend can call backend on localhost
- **Hot Reload**: Both frontend and backend support development hot reload

## 🚀 Deployment

### Deploy Backend to Azure
1. Create App Service
2. Configure OpenAI API key in app settings
3. Deploy using Visual Studio or Azure CLI

### Deploy Frontend to Vercel
1. Connect GitHub repo
2. Set build command: `npm run build`
3. Set output directory: `dist`

### Deploy Both to AWS
1. Use EC2 for backend (.NET deployment)
2. Use S3 + CloudFront for frontend (React SPA)
3. Use Lambda for serverless backend (future)

## 🐛 Troubleshooting

### Backend won't start
- Check .NET 10 is installed: `dotnet --version`
- Check OpenAI API key is valid
- Check port 5000 is not in use

### Frontend won't connect to backend
- Verify backend is running on `http://localhost:5000`
- Check CORS is enabled in Program.cs
- Try accessing `http://localhost:5000/swagger` to test backend

### OpenAI API errors
- Verify API key is correct
- Check account has available credits
- Monitor rate limits (3 RPM for free tier)

## 📝 Environment Variables

Create `.env` files for sensitive data:

**Backend (.env in backend folder)**
```
OPENAI_API_KEY=sk-...
```

**Frontend (.env in frontend folder)**
```
VITE_API_URL=http://localhost:5000
```

## 🎯 Next Steps

To extend the MVP:

1. **Add Authentication**: Implement user login/signup
2. **Add Database**: Store analysis history and saved offers
3. **Add Email Integration**: Send replies directly from the app
4. **Add Recruiter Dashboard**: Track recruiter outreach
5. **Add CRM**: Full candidate relationship management
6. **Add Payments**: Implement subscription tiers

## 📄 License

MIT License - Feel free to use this project for personal or commercial purposes.

## 👥 Support

For issues or questions:
1. Check the README files in backend/ and frontend/ folders
2. Review API response errors
3. Check OpenAI API status page

## 🎉 That's it!

You now have a working MVP of RecruiterReply. Start analyzing recruiter messages and comparing offers!
