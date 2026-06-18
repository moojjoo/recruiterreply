# MVP Requirements - RecruiterReply.com

## Overview

The MVP focuses on helping job seekers make informed career decisions and respond to recruiter communications intelligently. The platform provides AI-powered analysis, response generation, and opportunity tracking.

## Functional Requirements

### 1. User Authentication & Management

- **FR1.1**: Users can sign up with email/password
- **FR1.2**: Users can log in with email/password
- **FR1.3**: Users can log out
- **FR1.4**: Users can update their profile (name, email, profile picture)
- **FR1.5**: Users can reset forgotten passwords
- **FR1.6**: Session management with JWT tokens

### 2. AI Recruiter Message Analyzer

- **FR2.1**: User can paste recruiter email into the analyzer
- **FR2.2**: System analyzes and provides:
  - Market competitiveness score (1-10)
  - Compensation evaluation vs market rates
  - Red flag detection (unrealistic promises, poor communication, etc.)
  - Suggested response tone
- **FR2.3**: Results are displayed in an easy-to-read format
- **FR2.4**: User can copy suggestions to clipboard
- **FR2.5**: Analysis history is saved to user's account

### 3. AI Reply Generator

- **FR3.1**: User can generate replies in multiple categories:
  - Interested/Acceptance responses
  - Decline/Rejection responses
  - Counteroffer responses
  - Follow-up responses
- **FR3.2**: Generated responses are professional and customizable
- **FR3.3**: User can regenerate responses if unsatisfied
- **FR3.4**: User can edit and customize generated responses
- **FR3.5**: Generated replies are saved to analysis history

### 4. Offer Comparison Tool

- **FR4.1**: User can create comparison between offers
- **FR4.2**: Comparison includes:
  - Salary
  - Hourly rate
  - Benefits (health, 401k, PTO)
  - Commute/location
  - Remote work flexibility
  - Contract length
  - Start date
- **FR4.3**: System calculates and displays total compensation
- **FR4.4**: System provides pros/cons summary
- **FR4.5**: User can save comparisons for future reference

### 5. Candidate CRM

- **FR5.1**: User can track recruiters and companies
- **FR5.2**: User can create opportunities (applications/opportunities)
- **FR5.3**: Each opportunity tracks:
  - Company name
  - Position title
  - Job description
  - Recruiter information
  - Opportunity status (Lead, Applied, Interview, Offer, Closed)
  - Salary range
  - Last contact date
  - Next follow-up date
  - Notes
- **FR5.4**: User can set reminders for follow-ups
- **FR5.5**: User can view all opportunities in a list/kanban view
- **FR5.6**: User can filter and search opportunities

## Non-Functional Requirements

### Performance

- **NFR1.1**: Page load time < 2 seconds
- **NFR1.2**: AI analysis completes within 10 seconds
- **NFR1.3**: Database queries complete within 500ms

### Security

- **NFR2.1**: All passwords hashed with bcrypt
- **NFR2.2**: HTTPS for all communications
- **NFR2.3**: JWT tokens expire after 24 hours
- **NFR2.4**: Refresh tokens valid for 30 days
- **NFR2.5**: Input validation and sanitization on all endpoints
- **NFR2.6**: Protection against SQL injection, XSS, CSRF

### Scalability

- **NFR3.1**: Support minimum 1,000 concurrent users
- **NFR3.2**: Database optimized for queries
- **NFR3.3**: Caching strategy for frequently accessed data

### Accessibility

- **NFR4.1**: WCAG 2.1 AA compliance
- **NFR4.2**: Keyboard navigation support
- **NFR4.3**: Screen reader compatibility

## Technical Requirements

- **TR1**: Frontend built with React + TypeScript
- **TR2**: Backend built with ASP.NET Core (.NET 10)
- **TR3**: Database: PostgreSQL
- **TR4**: Authentication: JWT + OAuth 2.0
- **TR5**: AI Services: OpenAI API (GPT-4)
- **TR6**: Hosting: AWS
- **TR7**: CSS Framework: Tailwind CSS
- **TR8**: API: RESTful architecture

## API Endpoints (MVP)

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user
- POST `/api/auth/logout` - Logout user
- POST `/api/auth/refresh` - Refresh JWT token
- POST `/api/auth/password-reset` - Reset password

### User Profile
- GET `/api/users/profile` - Get user profile
- PUT `/api/users/profile` - Update user profile

### Message Analysis
- POST `/api/analysis/message` - Analyze recruiter message
- GET `/api/analysis/history` - Get analysis history
- GET `/api/analysis/{id}` - Get specific analysis

### Reply Generation
- POST `/api/replies/generate` - Generate reply
- GET `/api/replies/{analysisId}` - Get replies for analysis

### Offer Comparison
- POST `/api/comparisons` - Create new comparison
- GET `/api/comparisons` - Get user comparisons
- GET `/api/comparisons/{id}` - Get specific comparison
- PUT `/api/comparisons/{id}` - Update comparison
- DELETE `/api/comparisons/{id}` - Delete comparison

### Opportunities (CRM)
- POST `/api/opportunities` - Create opportunity
- GET `/api/opportunities` - List opportunities
- GET `/api/opportunities/{id}` - Get opportunity details
- PUT `/api/opportunities/{id}` - Update opportunity
- DELETE `/api/opportunities/{id}` - Delete opportunity
- PUT `/api/opportunities/{id}/status` - Update opportunity status

## User Stories

### US1: Message Analysis
**As a** job seeker  
**I want to** analyze recruiter emails  
**So that** I can understand the market value and identify red flags

### US2: Reply Generation
**As a** job seeker  
**I want to** generate professional responses  
**So that** I can respond quickly and professionally to recruiters

### US3: Offer Comparison
**As a** job seeker  
**I want to** compare multiple offers  
**So that** I can make an informed decision about which opportunity is best

### US4: Opportunity Tracking
**As a** job seeker  
**I want to** track all my job opportunities  
**So that** I don't miss follow-ups and can manage my job search

## Success Criteria for MVP

- ✅ Authentication system working
- ✅ AI message analysis functional
- ✅ Reply generation working
- ✅ Offer comparison tool usable
- ✅ Basic CRM functionality
- ✅ All core API endpoints tested
- ✅ Frontend UI complete for all features
- ✅ Database schema implemented
- ✅ Ready for beta user testing
