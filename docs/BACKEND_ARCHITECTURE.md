# Backend Architecture - RecruiterReply.com MVP

## Technology Stack

- **Framework**: ASP.NET Core 8
- **Language**: C#
- **Database**: PostgreSQL
- **ORM**: Entity Framework Core
- **Authentication**: JWT + OAuth 2.0
- **API Style**: RESTful
- **AI Service**: OpenAI API
- **Dependency Injection**: Built-in ASP.NET Core DI
- **Logging**: Serilog
- **Testing**: xUnit, Moq

## Project Structure

```
RecruiterReply.Backend/
├── src/
│   ├── RecruiterReply.API/
│   │   ├── Controllers/
│   │   │   ├── AuthController.cs
│   │   │   ├── UserController.cs
│   │   │   ├── MessageController.cs
│   │   │   ├── AnalysisController.cs
│   │   │   ├── ReplyController.cs
│   │   │   ├── ComparisonController.cs
│   │   │   └── OpportunitiesController.cs
│   │   ├── Middleware/
│   │   │   ├── ErrorHandlingMiddleware.cs
│   │   │   ├── AuthenticationMiddleware.cs
│   │   │   └── RequestLoggingMiddleware.cs
│   │   ├── Program.cs
│   │   └── appsettings.json
│   │
│   ├── RecruiterReply.Application/
│   │   ├── Services/
│   │   │   ├── AuthService.cs
│   │   │   ├── UserService.cs
│   │   │   ├── MessageService.cs
│   │   │   ├── AnalysisService.cs
│   │   │   ├── ReplyGenerationService.cs
│   │   │   ├── ComparisonService.cs
│   │   │   └── OpportunityService.cs
│   │   ├── DTOs/
│   │   │   ├── AuthDTOs.cs
│   │   │   ├── UserDTOs.cs
│   │   │   ├── MessageDTOs.cs
│   │   │   ├── AnalysisDTOs.cs
│   │   │   ├── ComparisonDTOs.cs
│   │   │   └── OpportunityDTOs.cs
│   │   ├── Interfaces/
│   │   │   ├── IAuthService.cs
│   │   │   ├── IUserService.cs
│   │   │   ├── IAnalysisService.cs
│   │   │   ├── IAIService.cs
│   │   │   └── (other service interfaces)
│   │   └── Validators/
│   │
│   ├── RecruiterReply.Domain/
│   │   ├── Entities/
│   │   │   ├── User.cs
│   │   │   ├── Message.cs
│   │   │   ├── MessageAnalysis.cs
│   │   │   ├── GeneratedReply.cs
│   │   │   ├── Opportunity.cs
│   │   │   ├── OfferComparison.cs
│   │   │   ├── ComparisonItem.cs
│   │   │   └── RefreshToken.cs
│   │   ├── ValueObjects/
│   │   │   └── (shared value objects)
│   │   └── Exceptions/
│   │       └── (custom exceptions)
│   │
│   └── RecruiterReply.Infrastructure/
│       ├── Data/
│       │   ├── RecruiterReplyDbContext.cs
│       │   └── Migrations/
│       ├── Repositories/
│       │   ├── UserRepository.cs
│       │   ├── MessageRepository.cs
│       │   ├── AnalysisRepository.cs
│       │   └── (other repositories)
│       ├── External Services/
│       │   ├── OpenAIService.cs
│       │   └── EmailService.cs
│       └── Configuration/
│           └── (database configurations)
│
└── tests/
    ├── RecruiterReply.UnitTests/
    ├── RecruiterReply.IntegrationTests/
    └── RecruiterReply.E2ETests/
```

## Layered Architecture

### 1. API Layer (RecruiterReply.API)
- **Responsibility**: Handle HTTP requests/responses
- **Contains**: Controllers, Middleware, Request/Response handling
- **Communication**: DTOs only (never domain entities)

### 2. Application Layer (RecruiterReply.Application)
- **Responsibility**: Business logic orchestration
- **Contains**: Services, DTOs, Validators, Use case implementation
- **Communication**: DTOs and domain entities

### 3. Domain Layer (RecruiterReply.Domain)
- **Responsibility**: Core business logic, rules, entities
- **Contains**: Entities, Value Objects, Interfaces, Custom Exceptions
- **Independent**: No dependencies on other layers

### 4. Infrastructure Layer (RecruiterReply.Infrastructure)
- **Responsibility**: Data access, external service integration
- **Contains**: DbContext, Repositories, External API clients
- **Communication**: With Domain and Application layers

## Key Services

### AuthService
- User registration
- User login with email/password
- JWT token generation
- Refresh token management
- Password reset flow

### AnalysisService
- Orchestrates message analysis workflow
- Calls OpenAI API for analysis
- Stores analysis results
- Manages analysis history

### ReplyGenerationService
- Generates contextual replies
- Supports multiple reply types
- Leverages OpenAI API
- Stores generated content

### ComparisonService
- Creates offer comparisons
- Calculates total compensation
- Provides comparison analytics
- Manages comparison persistence

### OpportunityService
- CRUD operations for opportunities
- Status tracking
- Follow-up reminders
- Search and filtering

### OpenAI Service
- GPT-4 API integration
- Prompt engineering
- Response parsing
- Error handling and retry logic

## Data Access Pattern (Repository Pattern)

```csharp
public interface IRepository<T> where T : Entity
{
    Task<T> GetByIdAsync(Guid id);
    Task<List<T>> GetAllAsync();
    Task AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(Guid id);
    IQueryable<T> AsQueryable();
}
```

Specific repositories extend this with domain-specific queries.

## Authentication Flow

```
1. User Registration/Login
   ├── POST /api/auth/register
   ├── POST /api/auth/login
   └── Returns: JWT + RefreshToken

2. Protected Requests
   ├── Include JWT in Authorization header
   ├── Middleware validates token
   └── Request proceeds if valid

3. Token Refresh
   ├── POST /api/auth/refresh
   ├── Submit RefreshToken
   └── Returns: New JWT + RefreshToken

4. Logout
   ├── POST /api/auth/logout
   ├── Invalidate RefreshToken
   └── Clear session
```

## AI Integration Flow

### Message Analysis
```
1. User submits recruiter email
2. API validates input
3. AnalysisService calls OpenAIService
4. OpenAI analyzes message
5. Results stored in MessageAnalysis table
6. Response returned to client
```

### Reply Generation
```
1. User requests reply
2. API retrieves message context
3. ReplyGenerationService calls OpenAI
4. Multiple response options generated
5. Results stored in GeneratedReplies table
6. Options presented to user
```

## Error Handling Strategy

- Custom exception hierarchy
- Global exception middleware
- Consistent error response format
- Logging of all exceptions
- User-friendly error messages

## Validation Strategy

- Input validation on API endpoints
- Business rule validation in services
- Database constraint enforcement
- Fluent validation for complex rules

## Caching Strategy

- JWT token caching (if needed)
- User profile caching
- Opportunity list caching
- Cache invalidation on updates

## Logging Strategy

- Structured logging with Serilog
- Log levels: Debug, Info, Warning, Error, Fatal
- Include request/response logging
- AI service call logging
- Performance metrics logging

## Security Measures

- HTTPS enforcement
- CORS configuration
- Input sanitization
- SQL injection prevention (EF Core parameterization)
- XSS protection
- CSRF tokens for state-changing operations
- Rate limiting on API endpoints
- Secure password hashing (bcrypt)

## Performance Considerations

- Database indexing strategy (see DATABASE_DESIGN.md)
- Async/await throughout
- Query optimization (eager loading, projections)
- Connection pooling
- Response pagination for large datasets
- Caching layer implementation

## Testing Strategy

- Unit tests for services (xUnit + Moq)
- Integration tests with test database
- API endpoint tests
- AI service mock testing
- Repository pattern testing

## Deployment Considerations

- Docker containerization
- Environment variable configuration
- Database migration automation
- Health check endpoints
- Graceful shutdown handling
