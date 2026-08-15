# AI Coding Agent Guide - RecruiterReply

This guide helps AI coding agents quickly understand and contribute to the RecruiterReply codebase.

## 🚀 Quick Start Commands

### Backend (ASP.NET CORE 10)
```bash
cd backend
dotnet restore        # Install dependencies
dotnet run           # Start API on http://localhost:5000
dotnet build         # Compile the project
```

### Frontend (React 18 + TypeScript)
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start dev server on http://localhost:5173
npm run build        # Build for production
```

## 🏗️ Project Structure & Architecture

### Backend Architecture
- **Pattern**: ASP.NET CORE 10 with Service-Repository pattern
- **ORM**: Entity Framework Core with PostgreSQL
- **Key Components**:
  - `Controllers/` - HTTP endpoints (RestAPI)
  - `Services/` - Business logic layer (OpenAI integration, analysis, comparisons)
  - `Repositories/` - Data access layer
  - `Entities/` - Database models
  - `Models/` - Request/Response DTOs
  - `Middleware/` - ErrorHandling, RequestLogging, Authentication
  - `Data/RecruiterReplyDbContext.cs` - EF Core DbContext

- **Key Services**:
  - `OpenAIService` - Wraps OpenAI API (GPT-4-Turbo)
  - `AnalysisService` - Message analysis logic
  - `ReplyService` - Reply generation logic
  - `ComparisonService` - Job offer comparison logic

- **Authentication**: JWT tokens + OAuth 2.0 (Google Sign-in)

### Frontend Architecture  
- **Pattern**: React component hierarchy with hooks
- **Routing**: React Router v6
- **State**: React Context + Custom Hooks (no Redux/Zustand)
- **Key Directories**:
  - `components/` - Reusable React components organized by feature
  - `pages/` - Full page components (routes)
  - `services/` - API client utilities
  - `types/` - TypeScript interfaces

- **Build Tool**: Vite (fast HMR, quick builds)
- **Styling**: Tailwind CSS + custom CSS

See [docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md) and [docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) for detailed architecture docs.

## 🔧 Development Conventions

### Backend (C#)
- **Naming**: PascalCase for classes/methods, camelCase for properties
- **Namespaces**: Match folder structure (e.g., `RecruiterReply.Services`, `RecruiterReply.Controllers`)
- **Async**: Use async/await throughout (methods end with `Async`)
- **Validation**: Use Entity Framework Core validators or custom validation middleware
- **DTOs**: Separate request/response models in Models/ folder
- **Dependency Injection**: Use ASP.NET CORE's built-in DI (registered in Program.cs)

### Frontend (TypeScript)
- **Naming**: PascalCase for components, camelCase for functions/variables
- **TypeScript**: Prefer explicit types over `any`, use interfaces for props
- **React Patterns**: Functional components with hooks (no class components)
- **Props**: Define interfaces/types for all component props
- **Styling**: Use Tailwind CSS utility classes (custom CSS in index.css only if necessary)

## ⚙️ Configuration & Secrets

### Backend Configuration
1. **OpenAI API Key**: Add to `backend/appsettings.json` (DON'T commit real keys)
   ```json
   {
     "OpenAI": {
       "ApiKey": "sk-proj-YOUR_KEY_HERE"
     }
   }
   ```

2. **.env Files**: Backend loads from `.env` files (multiple locations checked in Program.cs)
   - Supports DotNetEnv for local development
   - AWS Secrets Manager overrides .env when deployed (via `Aws:SecretsManager:SecretName`)

3. **JWT Configuration**: Set `Jwt:Issuer` and `Jwt:Key` in appsettings.json

### Frontend Configuration
- API base URL typically `http://localhost:5000` (dev) or configured in `src/services/api.ts`
- No sensitive keys should be stored in frontend code

## 📋 Key Implementation Patterns

### Adding a New API Endpoint
1. Create Controller method in `Controllers/`
2. Add corresponding Service method in `Services/`
3. If database access needed: create/update Repository and Entity
4. Register service in `Program.cs` if new
5. Test with Swagger UI at `/swagger`

### Adding a New Frontend Feature
1. Create TypeScript types in `src/types/` if new data structure
2. Create React component in `src/components/` (folder per feature)
3. Create API service call in `src/services/api.ts`
4. Create page component or integrate into existing page
5. Add route to App.tsx if new page

### OpenAI Integration
- All OpenAI calls go through `OpenAIService`
- Uses GPT-4-Turbo by default
- Responses are parsed and transformed by feature-specific services
- Always handle rate limits and API errors gracefully

## ⚠️ Important Gotchas & Best Practices

1. **API Keys**: Never commit real OpenAI keys. Placeholder format: `sk-proj-...`
2. **CORS**: Backend needs proper CORS configuration for frontend requests (check Program.cs)
3. **Async/Await**: C# code heavily uses async - don't block on async calls
4. **Database Migrations**: Use `dotnet ef migrations` to generate migrations before committing
5. **TypeScript Strict Mode**: Project uses `strict: true` - all types must be explicit
6. **Component Imports**: Use explicit relative paths (e.g., `./components/`) not barrel exports when performance matters

## 📚 Documentation References

- **Full Setup Guide**: [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **Backend Details**: [docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md)
- **Frontend Details**: [docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md)
- **Database Schema**: [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- **Authentication Design**: [docs/AUTHENTICATION_DESIGN.md](docs/AUTHENTICATION_DESIGN.md)
- **API Endpoints**: Swagger UI at `http://localhost:5000/swagger` (after running backend)

## 🎯 Common Development Tasks

### Running Backend Tests
```bash
cd backend
dotnet test
```

### Building for Production
```bash
# Backend
cd backend && dotnet build -c Release

# Frontend
cd frontend && npm run build
```

### Viewing API Documentation
- After starting backend: `http://localhost:5000/swagger`

### Debugging Tips
- **Backend**: Add breakpoints in Visual Studio Code or Visual Studio
- **Frontend**: Use React DevTools browser extension + Console
- **API Calls**: Check Network tab in browser DevTools for request/response
- **Database**: Use pgAdmin or DBeaver to inspect PostgreSQL directly

## 🚦 Branch & Commit Strategy

- **Current Branch**: Feature branches named `feature_XX_description`
- **Default Branch**: `dev` (see attachment for current branch context)
- **Commits**: Use conventional commits (see `/commit-msg` skill for generating messages)
- **Before Push**: Run `/code-review` to check for console.log, hardcoded values, etc.
- **Secret Scan**: Always check for API keys before pushing (see user memory: git.md)

---

**Last Updated**: 2026-08-14  
**Version**: MVP Phase  
**Tech Stack**: ASP.NET CORE 10 + React 18 + TypeScript + Tailwind CSS
