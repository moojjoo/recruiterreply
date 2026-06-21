# RecruiterReply MVP - Complete Setup Guide

## 📦 What Was Created

### Backend (ASP.NET CORE 10)

**Project Files:**
- `RecruiterReply.csproj` - Project configuration
- `Program.cs` - Application startup and configuration
- `appsettings.json` - Application settings (includes OpenAI API key placeholder)

**Controllers (3 total):**
- `AnalysisController.cs` - Handles recruiter message analysis endpoint
- `ReplyController.cs` - Handles reply generation endpoint
- `ComparisonController.cs` - Handles offer comparison endpoint

**Services (4 total):**
- `OpenAIService.cs` - Wraps OpenAI API calls with prompts
- `AnalysisService.cs` - Orchestrates message analysis logic
- `ReplyService.cs` - Orchestrates reply generation logic
- `ComparisonService.cs` - Orchestrates offer comparison logic

**Models (6 total):**
- `AnalyzeMessageRequest/Response.cs` - Message analyzer DTOs
- `GenerateReplyRequest/Response.cs` - Reply generator DTOs
- `JobOffer.cs` - Job offer data structure
- `CompareOffersRequest/Response.cs` - Offer comparison DTOs

### Frontend (React 18 + TypeScript)

**Configuration Files:**
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite build configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `index.html` - HTML entry point

**Components (6 total):**
- `MessageAnalyzer.tsx` - Form to paste and analyze recruiter messages
- `AnalysisResult.tsx` - Displays analysis results
- `ReplyGenerator.tsx` - Form to generate replies
- `ReplyResult.tsx` - Displays generated reply
- `ComparisonTool.tsx` - Form to enter two job offers
- `ComparisonResult.tsx` - Displays comparison results

**Pages (4 total):**
- `HomePage.tsx` - Landing page with feature overview
- `AnalysisPage.tsx` - Message analyzer page
- `ReplyPage.tsx` - Reply generator page
- `ComparisonPage.tsx` - Offer comparison page

**Supporting Files:**
- `App.tsx` - Main app component with navigation
- `main.tsx` - React entry point
- `api.ts` - API client service
- `types/index.ts` - TypeScript interfaces
- `index.css` - Tailwind CSS and custom styles

**Additional Files:**
- `README.md` - Frontend documentation
- `.gitignore` - Git ignore patterns

---

## 🚀 How to Run Everything

### Prerequisites

1. **Install .NET 10 SDK**
   - Download from: https://dotnet.microsoft.com/download/dotnet/10.0
   - Verify: `dotnet --version`

2. **Install Node.js 18+**
   - Download from: https://nodejs.org/
   - Verify: `node --version` and `npm --version`

3. **Get OpenAI API Key**
   - Go to: https://platform.openai.com/api-keys
   - Create a new secret key
   - Copy it (you'll need it in the next step)

### Step-by-Step Setup

#### 1️⃣ Configure Backend with OpenAI API Key

```bash
cd backend
```

Open `appsettings.json` and replace:
```json
"OpenAI": {
  "ApiKey": "YOUR_OPENAI_API_KEY_HERE"
}
```

With your actual API key:
```json
"OpenAI": {
  "ApiKey": "sk-proj-xxx..."
}
```

#### 2️⃣ Start Backend Server

```bash
# Still in backend folder
dotnet restore
dotnet run
```

Expected output:
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5000
      Now listening on: https://localhost:5001
```

✅ **Backend is ready!** 
- API: http://localhost:5000
- Swagger UI: http://localhost:5000/swagger
- Try it: POST to http://localhost:5000/api/analyze-recruiter-message

#### 3️⃣ Start Frontend Server (in a NEW terminal)

```bash
cd frontend
npm install
npm run dev
```

Expected output:
```
  VITE v5.0.8  ready in XXX ms

  ➜  Local:   http://localhost:5173/
```

✅ **Frontend is ready!**
- App: http://localhost:5173

#### 4️⃣ Open in Browser

Visit: **http://localhost:5173**

You should see the RecruiterReply homepage with 3 features!

---

## 🧪 Test Each Feature

### Feature 1: Message Analyzer
1. Click "Analyze" button in navigation
2. Paste a recruiter email (or use the example below)
3. Click "Analyze Message"
4. See the AI-powered analysis

**Test Email:**
```
Subject: Exciting Senior Engineer Opportunity at TechCorp

Hi there,

We came across your profile and are impressed with your background. We're hiring a Senior Engineer for our growth team. The role is remote, and we're offering:

- Base salary: $140,000 - $160,000
- Performance bonus: 10-20%
- Equity: 0.1% - 0.2%
- Full health, dental, vision
- 25 days PTO
- MacBook Pro
- Learning budget: $2,000/year

We need to move quickly on this role - can you start a conversation with our recruiter this week?

Best,
Jane at TechCorp
```

**Expected Results:**
- Compensation score and analysis
- Red flags (tight timeline, vague equity)
- Questions to ask
- Suggested response
- Opportunity score (e.g., 72/100)

---

### Feature 2: Reply Generator
1. Click "Reply" button in navigation
2. Select a reply type (e.g., "Interested")
3. Paste the recruiter message from above
4. Optionally add:
   - Minimum pay: 130000
   - Work arrangement: Remote
   - Notes: Prefer established companies
5. Click "Generate Reply"
6. Get a professional AI-written reply
7. Copy to clipboard

**Expected Result:** Professional email response matching your preferences

---

### Feature 3: Offer Comparison
1. Click "Compare" button in navigation
2. Enter Offer 1:
   - Company: TechCorp
   - Job Title: Senior Engineer
   - Salary: 150000
   - Type: W2
   - Benefits estimate: 20000
   - Commute: 0 min
   - Arrangement: Remote

3. Enter Offer 2:
   - Company: StartupXYZ
   - Job Title: Lead Engineer
   - Salary: 160000
   - Type: W2
   - Benefits estimate: 5000
   - Commute: 30 min
   - Arrangement: Hybrid

4. Click "Compare Offers"
5. Get comparison with:
   - Annual values
   - Pros/cons lists
   - Risk levels
   - Recommendation

**Expected Result:** Detailed comparison with recommended offer

---

## 📁 Where OpenAI API Key Goes

### Current (Development)
File: `backend/appsettings.json`
```json
{
  "OpenAI": {
    "ApiKey": "sk-..."
  }
}
```

### Other Options

**Option 2: Environment Variable**
```bash
# Windows
set OPENAI_API_KEY=sk-...
dotnet run

# Linux/Mac
export OPENAI_API_KEY=sk-...
dotnet run
```

Then update `appsettings.json`:
```json
{
  "OpenAI": {
    "ApiKey": "${OPENAI_API_KEY}"
  }
}
```

**Option 3: User Secrets (Recommended for Development)**
```bash
cd backend
dotnet user-secrets init
dotnet user-secrets set "OpenAI:ApiKey" "sk-..."
dotnet run
```

---

## 📝 Files Created Summary

### Backend Files
```
backend/
├── RecruiterReply.csproj
├── Program.cs
├── appsettings.json
├── .gitignore
├── README.md
├── Controllers/
│   ├── AnalysisController.cs
│   ├── ReplyController.cs
│   └── ComparisonController.cs
├── Services/
│   ├── IOpenAIService.cs
│   ├── OpenAIService.cs
│   ├── IAnalysisService.cs
│   ├── AnalysisService.cs
│   ├── IReplyService.cs
│   ├── ReplyService.cs
│   ├── IComparisonService.cs
│   └── ComparisonService.cs
└── Models/
    ├── AnalyzeMessageRequest.cs
    ├── AnalyzeMessageResponse.cs
    ├── GenerateReplyRequest.cs
    ├── GenerateReplyResponse.cs
    ├── JobOffer.cs
    ├── CompareOffersRequest.cs
    └── CompareOffersResponse.cs
```

### Frontend Files
```
frontend/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── index.html
├── .gitignore
├── README.md
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types/
    │   └── index.ts
    ├── services/
    │   └── api.ts
    ├── components/
    │   ├── MessageAnalyzer.tsx
    │   ├── AnalysisResult.tsx
    │   ├── ReplyGenerator.tsx
    │   ├── ReplyResult.tsx
    │   ├── ComparisonTool.tsx
    │   └── ComparisonResult.tsx
    └── pages/
        ├── HomePage.tsx
        ├── AnalysisPage.tsx
        ├── ReplyPage.tsx
        └── ComparisonPage.tsx
```

### Documentation Files
```
docs/
├── PRODUCT_VISION.md (existing)
├── MVP_REQUIREMENTS.md
├── DATABASE_DESIGN.md
├── BACKEND_ARCHITECTURE.md
├── FRONTEND_ARCHITECTURE.md
├── USER_STORIES.md
├── DATABASE_SCHEMA.md
└── SPRINT_1_PLAN.md
```

### Root Files
```
├── README.md (main project README)
├── backend/ (folder)
├── frontend/ (folder)
└── docs/ (folder)
```

---

## 🔌 API Endpoints

All endpoints are POST and expect JSON:

| Endpoint | Purpose | Requires |
|----------|---------|----------|
| `POST /api/analyze-recruiter-message` | Analyze recruiter email | recruiterMessage (text) |
| `POST /api/generate-reply` | Generate reply | replyType, recruiterMessage |
| `POST /api/compare-offers` | Compare job offers | offerOne, offerTwo |

Swagger UI available at: **http://localhost:5000/swagger**

---

## 🎯 Quick Troubleshooting

### "Backend not found" error in Frontend
- Verify backend is running on port 5000
- Check: `http://localhost:5000/swagger`

### "Invalid API Key" error
- Verify OpenAI key is correct in `appsettings.json`
- Check account has credits at https://platform.openai.com/account/usage/overview

### "Port already in use" error
- Backend: Change port in `Program.cs`
- Frontend: Change port in `vite.config.ts`

### Frontend doesn't load
- Clear browser cache: Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
- Restart frontend server: Ctrl+C then `npm run dev`

---

## 📚 Next Steps

1. **Test all 3 features** with the test data above
2. **Explore Swagger UI** at http://localhost:5000/swagger
3. **Read the READMEs**:
   - Backend: `backend/README.md`
   - Frontend: `frontend/README.md`
   - Documentation: `docs/`

4. **Future enhancements**:
   - Add user authentication
   - Add database for history
   - Deploy to cloud (Vercel, Azure, AWS)
   - Add email sending
   - Add more AI features

---

## ✨ You're Ready!

The MVP is fully functional. You can now:
- ✅ Analyze recruiter messages
- ✅ Generate professional replies
- ✅ Compare job offers

Enjoy using RecruiterReply! 🎉
