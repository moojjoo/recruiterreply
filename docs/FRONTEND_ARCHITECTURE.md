# Frontend Architecture - RecruiterReply.com MVP

## Technology Stack

- **Framework**: React 18
- **Language**: TypeScript
- **State Management**: React Context + Custom Hooks
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Form Handling**: React Hook Form
- **Routing**: React Router v6
- **Date Handling**: date-fns
- **Testing**: Vitest + React Testing Library
- **Build Tool**: Vite
- **Package Manager**: npm/yarn

## Project Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   ├── PasswordReset.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── analysis/
│   │   │   ├── MessageAnalyzer.tsx
│   │   │   ├── AnalysisResult.tsx
│   │   │   ├── AnalysisHistory.tsx
│   │   │   └── RedFlagsList.tsx
│   │   ├── replies/
│   │   │   ├── ReplyGenerator.tsx
│   │   │   ├── ReplyTypeSelector.tsx
│   │   │   ├── GeneratedReplyCard.tsx
│   │   │   └── ReplyEditor.tsx
│   │   ├── comparisons/
│   │   │   ├── OfferComparison.tsx
│   │   │   ├── ComparisonForm.tsx
│   │   │   ├── ComparisonResult.tsx
│   │   │   └── ComparisonList.tsx
│   │   ├── crm/
│   │   │   ├── OpportunitiesView.tsx
│   │   │   ├── OpportunityCard.tsx
│   │   │   ├── OpportunityForm.tsx
│   │   │   ├── OpportunityDetail.tsx
│   │   │   ├── StatusKanban.tsx
│   │   │   └── OpportunitiesFilter.tsx
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── MainLayout.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── TextArea.tsx
│   │       ├── Modal.tsx
│   │       ├── Toast.tsx
│   │       ├── Card.tsx
│   │       └── ErrorBoundary.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── MessageAnalysis.tsx
│   │   ├── OfferComparison.tsx
│   │   ├── Opportunities.tsx
│   │   ├── Profile.tsx
│   │   ├── NotFound.tsx
│   │   └── Home.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   ├── useAnalysis.ts
│   │   ├── useComparison.ts
│   │   ├── useOpportunities.ts
│   │   ├── useForm.ts
│   │   └── useLocalStorage.ts
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   ├── ToastContext.tsx
│   │   └── UIContext.tsx
│   ├── services/
│   │   ├── api/
│   │   │   ├── authService.ts
│   │   │   ├── userService.ts
│   │   │   ├── messageService.ts
│   │   │   ├── analysisService.ts
│   │   │   ├── replyService.ts
│   │   │   ├── comparisonService.ts
│   │   │   ├── opportunityService.ts
│   │   │   └── apiClient.ts
│   │   └── utils/
│   │       ├── tokenManager.ts
│   │       ├── errorHandler.ts
│   │       └── formatters.ts
│   ├── types/
│   │   ├── auth.ts
│   │   ├── message.ts
│   │   ├── analysis.ts
│   │   ├── reply.ts
│   │   ├── comparison.ts
│   │   ├── opportunity.ts
│   │   ├── api.ts
│   │   └── index.ts
│   ├── styles/
│   │   ├── globals.css
│   │   ├── colors.css
│   │   └── animations.css
│   ├── utils/
│   │   ├── validators.ts
│   │   ├── formatters.ts
│   │   ├── constants.ts
│   │   └── helpers.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── package.json
```

## Core Architecture Patterns

### 1. Component Architecture

**Smart Components (Container)**
- Handle logic, state, API calls
- Use custom hooks
- Manage context
- Example: `Dashboard.tsx`, `OfferComparison.tsx`

**Presentational Components (Dumb)**
- Receive data via props
- Pure rendering logic
- Reusable across features
- Example: `Button.tsx`, `Card.tsx`, `Input.tsx`

### 2. Custom Hooks Pattern

```typescript
// useApi.ts - Generic API hook
export const useApi = <T,>(
  url: string,
  options?: RequestConfig
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Fetch logic
  }, [url]);

  return { data, loading, error };
};

// useAnalysis.ts - Domain-specific hook
export const useAnalysis = () => {
  const { post } = useApi<AnalysisResult>('/api/analysis/message');
  // Analysis-specific logic
  return { analyzeMessage, history };
};
```

### 3. Context API for Global State

**AuthContext**
- Current user
- Authentication status
- Login/logout methods
- Token management

**ToastContext**
- Show notifications
- Error/success messages
- Global notifications

**UIContext**
- Loading states
- Modal visibility
- Theme preferences

### 4. Type Safety with TypeScript

```typescript
// types/analysis.ts
export interface MessageAnalysisRequest {
  subject: string;
  body: string;
  senderEmail: string;
  senderName?: string;
  companyName?: string;
}

export interface AnalysisResult {
  id: string;
  competitivenessScore: number;
  compensationEvaluation: CompensationEvaluation;
  redFlags: string[];
  suggestedTone: string;
  createdAt: Date;
}

export interface CompensationEvaluation {
  salaryMin: number;
  salaryMax: number;
  marketRateMin: number;
  marketRateMax: number;
  percentile: number;
  assessment: string;
}
```

## Page Flows

### Authentication Flow
```
Home → Login/Register → Dashboard
(Protected Routes check auth context)
```

### Message Analysis Flow
```
Dashboard → Message Analysis
  ↓ User pastes email
  ↓ Submit for analysis
  ↓ Show loading spinner
  ↓ Display results
  ↓ Generate reply button
  ↓ Save to history
```

### Offer Comparison Flow
```
Dashboard → Offer Comparison
  ↓ Create new comparison
  ↓ Add offer details (Company, Salary, Benefits, etc.)
  ↓ Add multiple offers
  ↓ View comparison results
  ↓ See total compensation calculation
  ↓ Save comparison
```

### CRM Flow
```
Dashboard → Opportunities
  ↓ View all opportunities (List/Kanban)
  ↓ Create new opportunity
  ↓ Update opportunity details
  ↓ Change status
  ↓ Set follow-up reminders
  ↓ Filter and search
```

## API Integration Layer

### API Client Setup
```typescript
// services/api/apiClient.ts
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptors
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401, refresh token, etc.
    return Promise.reject(error);
  }
);
```

### Service Layer Pattern
```typescript
// services/api/analysisService.ts
export const analysisService = {
  analyzeMessage: (message: MessageAnalysisRequest) =>
    apiClient.post<AnalysisResult>('/api/analysis/message', message),
  
  getHistory: (limit?: number) =>
    apiClient.get<AnalysisResult[]>('/api/analysis/history', {
      params: { limit },
    }),
  
  getAnalysis: (id: string) =>
    apiClient.get<AnalysisResult>(`/api/analysis/${id}`),
};
```

## State Management

### Local State (useState)
- Form inputs
- UI toggles (modal open/close)
- Temporary data

### Context State
- User authentication
- Global notifications
- Theme/UI preferences

### Server State (via hooks)
- API data caching (in hooks)
- Loading states
- Error states

## Styling Approach

- **Tailwind CSS** for utility-first styling
- **CSS Modules** for component-specific styles (optional)
- **Global CSS** for base styles and theme
- Consistent color palette
- Responsive design (mobile-first)

## Component Example

```typescript
// components/analysis/MessageAnalyzer.tsx
interface MessageAnalyzerProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
}

export const MessageAnalyzer: React.FC<MessageAnalyzerProps> = ({
  onAnalysisComplete,
}) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useContext(ToastContext);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await analysisService.analyzeMessage({
        body: message,
      });
      onAnalysisComplete(result.data);
      showToast('Analysis complete!', 'success');
    } catch (error) {
      showToast('Analysis failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <TextArea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Paste recruiter email here..."
          disabled={loading}
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze'}
        </Button>
      </form>
    </Card>
  );
};
```

## Performance Optimization

- **Code Splitting**: Route-based splitting with React.lazy
- **Image Optimization**: Lazy loading images
- **Memoization**: React.memo for expensive components
- **Virtual Lists**: For long opportunity lists
- **API Caching**: Implement with React Query (future)

## Responsive Design

- Mobile-first Tailwind approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-friendly button sizes (48px minimum)
- Flexible layout components

## Testing Strategy

- Unit tests for services and utilities
- Component tests with React Testing Library
- Integration tests for user flows
- E2E tests for critical paths

## Accessibility

- WCAG 2.1 AA compliance
- Semantic HTML
- ARIA labels where needed
- Keyboard navigation
- Color contrast requirements
- Focus management
