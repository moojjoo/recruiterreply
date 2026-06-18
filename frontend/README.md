# RecruiterReply Frontend

React 18 + TypeScript + Tailwind CSS frontend for RecruiterReply MVP

## 🎯 Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open: **http://localhost:5173**

## 📋 Prerequisites

- Node.js 18+ ([download](https://nodejs.org))
- Backend API running on http://localhost:5000
- See [main README](../README.md) for full setup

## 🏗️ Project Structure

```
src/
├── components/                   # Reusable UI components
│   ├── MessageAnalyzer.tsx       # Paste & analyze recruiter message
│   ├── AnalysisResult.tsx        # Display analysis (red flags, score)
│   ├── ReplyGenerator.tsx        # Generate professional reply
│   ├── ReplyResult.tsx           # Display generated reply
│   ├── ComparisonTool.tsx        # Compare two job offers
│   └── ComparisonResult.tsx      # Display comparison with recommendation
├── pages/                        # Page-level components
│   ├── HomePage.tsx              # Landing page with feature overview
│   ├── AnalysisPage.tsx          # Full message analyzer page
│   ├── ReplyPage.tsx             # Full reply generator page
│   └── ComparisonPage.tsx        # Full offer comparison page
├── services/
│   └── api.ts                    # Axios API client with error handling
├── types/
│   └── index.ts                  # TypeScript interfaces (DTOs)
├── App.tsx                       # Main app component + navigation
├── main.tsx                      # React entry point
└── index.css                     # Tailwind CSS + custom styles
```

## 🛠️ Build & Deploy

### Development

```bash
npm run dev       # Start dev server on port 5173
npm run lint      # Check for code issues
```

### Production

```bash
npm run build     # Build optimized bundle to dist/
npm run preview   # Preview production build locally
```

## 📦 Dependencies

- **react** 18.2.0 - UI framework
- **typescript** 5.2.2 - Type safety
- **axios** 1.6.0 - HTTP client
- **vite** 5.0.8 - Build tool
- **tailwindcss** 3.3.6 - Styling
- **postcss** 8.4.31 - CSS processing

## 🔧 Configuration

### API URL

The frontend proxies API calls to the backend via Vite.

**Default (development):**
- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- Proxy: `/api` → http://localhost:5000

**Custom backend URL:**

Create `.env.local`:
```bash
VITE_API_URL=http://192.168.1.100:5000/api
```

Or for production:
```bash
VITE_API_URL=https://api.yourdomain.com
```

See [.env.example](../.env.example) for more options.

## 🎯 Features

### Message Analyzer 📊
```
Input: Recruiter email
↓
AI Analysis
↓
Output: 
- Compensation details
- Red flags ⚠️
- Questions to ask
- Opportunity score (1-100)
- Suggested response
```

### Reply Generator ✉️
```
Input: 
- Message
- Reply type (interested/request pay/etc)
- Preferences (min pay, work arrangement)
↓
AI Generation
↓
Output: Professional email reply
```

### Offer Comparison ⚖️
```
Input: Two job offers
↓
AI Comparison
↓
Output:
- Annual value calculation
- Pros/cons list
- Risk levels
- Recommendation
```

## 🔐 Security

✅ **No API keys in frontend code**
✅ **All OpenAI calls through backend**
✅ **Environment variables for configuration**
✅ **Error messages without exposing secrets**

Error handling:
```typescript
try {
  const result = await analysisService.analyzeMessage(request);
} catch (err) {
  // Shows user-friendly error message
  // Backend error details not exposed
  setError('Failed to analyze. Check backend is running.');
}
```

## 🧪 Component Testing

Each component has:
- Loading state with spinner
- Error display
- Input validation
- Disabled state during API calls

Example button states:
```
Idle:     [Analyze Message]
Loading:  [⟳ Analyzing...]
Error:    [Error message shown below]
```

## 📊 API Integration

All API calls go through `services/api.ts`:

```typescript
// Typed requests
analysisService.analyzeMessage({
  recruiterMessage: string
  companyName?: string
  jobTitle?: string
})

// Typed responses
AnalyzeMessageResponse {
  compensationMentioned: string
  jobType: string
  redFlags: string[]
  questionsToAsk: string[]
  suggestedResponse: string
  opportunityScore: number
}
  - Recommendation

## Troubleshooting

### Backend Not Responding

Make sure backend is running:
```bash
cd backend
dotnet run
```

Backend should be on `http://localhost:5000`

### Port Already in Use

Change port in `vite.config.ts`:
```typescript
server: {
  port: 3000  // Change to different port
}
```

### OpenAI API Errors

Check that backend has valid OpenAI API key set in `appsettings.json`

## Development

### Hot Module Reload

Vite automatically reloads the page when you save files.

### Linting

```bash
npm run lint
```

## Deployment

### Vercel/Netlify

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist/` folder

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## API Reference

See [Backend README](../backend/README.md) for API endpoint documentation.

## Notes

- No authentication currently implemented
- Uses Tailwind CSS for styling
- Responsive design for mobile and desktop
- Client-side form validation
