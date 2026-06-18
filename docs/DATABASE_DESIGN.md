# Database Design - RecruiterReply.com MVP

## Overview

PostgreSQL database schema designed for MVP features: user management, message analysis, reply generation, offer comparison, and opportunity tracking.

## Database Tables

### 1. Users

Stores user account information.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  profile_picture_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_email (email)
);
```

### 2. Messages (Recruiter Emails)

Stores original recruiter messages for analysis.

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(500),
  body TEXT NOT NULL,
  sender_email VARCHAR(255),
  sender_name VARCHAR(255),
  company_name VARCHAR(255),
  received_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

### 3. Message Analyses

Stores AI analysis results for recruiter messages.

```sql
CREATE TABLE message_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competitiveness_score INT CHECK (competitiveness_score >= 1 AND competitiveness_score <= 10),
  compensation_evaluation JSONB,
  red_flags JSONB,
  analysis_summary TEXT,
  suggested_tone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_message_id (message_id)
);
```

**compensation_evaluation structure:**
```json
{
  "salary_min": 100000,
  "salary_max": 130000,
  "market_rate_min": 110000,
  "market_rate_max": 140000,
  "percentile": 75,
  "assessment": "below market"
}
```

**red_flags structure:**
```json
[
  "Unrealistic timeline",
  "No specific compensation mentioned",
  "Pressure to respond quickly"
]
```

### 4. Generated Replies

Stores AI-generated responses.

```sql
CREATE TABLE generated_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES message_analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reply_type VARCHAR(50) NOT NULL, -- 'interested', 'decline', 'counteroffer', 'followup'
  content TEXT NOT NULL,
  tone VARCHAR(50),
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_analysis_id (analysis_id)
);
```

### 5. Opportunities (CRM)

Stores job opportunities and tracking information.

```sql
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  position_title VARCHAR(255) NOT NULL,
  recruiter_name VARCHAR(255),
  recruiter_email VARCHAR(255),
  job_description TEXT,
  status VARCHAR(50) DEFAULT 'lead', -- 'lead', 'applied', 'interview', 'offer', 'closed'
  salary_min INT,
  salary_max INT,
  job_type VARCHAR(50), -- 'full-time', 'contract', 'part-time'
  location VARCHAR(255),
  remote_flexibility VARCHAR(50), -- 'on-site', 'hybrid', 'remote'
  start_date DATE,
  source VARCHAR(100), -- 'referral', 'job-board', 'recruiter', 'other'
  last_contact_date TIMESTAMP,
  next_followup_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

### 6. Offer Comparisons

Stores offer comparison data.

```sql
CREATE TABLE offer_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
);
```

### 7. Comparison Items

Individual offers within a comparison.

```sql
CREATE TABLE comparison_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id UUID NOT NULL REFERENCES offer_comparisons(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  position_title VARCHAR(255) NOT NULL,
  salary DECIMAL(12, 2),
  hourly_rate DECIMAL(8, 2),
  signing_bonus DECIMAL(12, 2),
  annual_bonus DECIMAL(12, 2),
  stock_options VARCHAR(255),
  health_insurance BOOLEAN,
  dental_insurance BOOLEAN,
  vision_insurance BOOLEAN,
  retirement_401k BOOLEAN,
  pto_days INT,
  commute_minutes INT,
  remote_flexibility VARCHAR(50), -- 'on-site', 'hybrid', 'remote'
  contract_length_months INT,
  start_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comparison_id (comparison_id)
);
```

### 8. Refresh Tokens

Stores valid refresh tokens for authentication.

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_revoked BOOLEAN DEFAULT FALSE,
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);
```

### 9. Audit Log

Tracks important user actions for security and analytics.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_messages_user_id_created ON messages(user_id, created_at DESC);
CREATE INDEX idx_analyses_user_id_created ON message_analyses(user_id, created_at DESC);
CREATE INDEX idx_opportunities_user_status ON opportunities(user_id, status);
CREATE INDEX idx_comparison_items_comparison ON comparison_items(comparison_id);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
```

## Constraints & Relationships

```
users (1) -----> (N) messages
users (1) -----> (N) message_analyses
users (1) -----> (N) generated_replies
users (1) -----> (N) opportunities
users (1) -----> (N) offer_comparisons
users (1) -----> (N) refresh_tokens
users (1) -----> (N) audit_logs

messages (1) -----> (N) message_analyses
message_analyses (1) -----> (N) generated_replies

offer_comparisons (1) -----> (N) comparison_items
```

## Data Retention Policy

- **User accounts**: Retained indefinitely unless deleted
- **Messages & Analyses**: Retained for 2 years
- **Generated Replies**: Retained for 2 years
- **Opportunities**: Retained indefinitely
- **Comparisons**: Retained indefinitely
- **Refresh Tokens**: Deleted after expiration (30 days)
- **Audit Logs**: Retained for 1 year

## Migration Strategy

1. Create all tables
2. Create indexes
3. Add constraints
4. Seed test data if needed
5. Run performance tests

## Future Enhancements

- Sharding strategy for scalability
- Read replicas for analytics queries
- Archival database for historical data
- Full-text search optimization
