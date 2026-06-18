# Database Schema - RecruiterReply.com MVP

## Complete PostgreSQL Schema

### Table 1: Users

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
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
```

**Description:** Stores user account information and authentication details.

**Columns:**
- `id`: Primary key, automatically generated UUID
- `email`: Unique email address
- `password_hash`: Bcrypt hashed password
- `first_name`, `last_name`: User name
- `profile_picture_url`: S3 URL to profile image
- `created_at`: Account creation timestamp
- `updated_at`: Last profile update
- `last_login`: Last login timestamp
- `is_active`: Soft delete flag

---

### Table 2: Messages

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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_user_created ON messages(user_id, created_at DESC);
CREATE INDEX idx_messages_company ON messages(company_name);
```

**Description:** Original recruiter messages/emails pasted by users.

**Columns:**
- `id`: Primary key
- `user_id`: Foreign key to users
- `subject`: Email subject line
- `body`: Full email body
- `sender_email`: Recruiter's email
- `sender_name`: Recruiter's name
- `company_name`: Company name
- `received_date`: When email was received
- `created_at`: When pasted into system

---

### Table 3: Message Analyses

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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analyses_message_id ON message_analyses(message_id);
CREATE INDEX idx_analyses_user_id ON message_analyses(user_id);
CREATE INDEX idx_analyses_user_created ON message_analyses(user_id, created_at DESC);
```

**Description:** AI analysis results of recruiter messages.

**Columns:**
- `id`: Primary key
- `message_id`: Foreign key to messages
- `user_id`: Foreign key to users
- `competitiveness_score`: 1-10 score of market competitiveness
- `compensation_evaluation`: JSON with salary analysis
- `red_flags`: JSON array of detected red flags
- `analysis_summary`: Text summary of analysis
- `suggested_tone`: Suggested response tone

**compensation_evaluation structure:**
```json
{
  "salary_min": 100000,
  "salary_max": 130000,
  "market_rate_min": 110000,
  "market_rate_max": 140000,
  "percentile": 75,
  "assessment": "below_market",
  "analysis_details": "..."
}
```

**red_flags structure:**
```json
[
  "Unrealistic timeline",
  "No specific compensation mentioned",
  "Pressure to respond quickly",
  "Vague job description"
]
```

---

### Table 4: Generated Replies

```sql
CREATE TABLE generated_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES message_analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reply_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  tone VARCHAR(50),
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_replies_analysis_id ON generated_replies(analysis_id);
CREATE INDEX idx_replies_user_id ON generated_replies(user_id);
CREATE INDEX idx_replies_type ON generated_replies(reply_type);
```

**Description:** AI-generated reply suggestions to recruiter messages.

**Columns:**
- `id`: Primary key
- `analysis_id`: Foreign key to message_analyses
- `user_id`: Foreign key to users
- `reply_type`: Type of reply (interested, decline, counteroffer, followup)
- `content`: Generated reply text
- `tone`: Tone of reply
- `is_used`: Whether user sent this reply
- `used_at`: When reply was sent

---

### Table 5: Opportunities

```sql
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  position_title VARCHAR(255) NOT NULL,
  recruiter_name VARCHAR(255),
  recruiter_email VARCHAR(255),
  job_description TEXT,
  status VARCHAR(50) DEFAULT 'lead',
  salary_min INT,
  salary_max INT,
  job_type VARCHAR(50),
  location VARCHAR(255),
  remote_flexibility VARCHAR(50),
  start_date DATE,
  source VARCHAR(100),
  last_contact_date TIMESTAMP,
  next_followup_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_opportunities_user_id ON opportunities(user_id);
CREATE INDEX idx_opportunities_user_status ON opportunities(user_id, status);
CREATE INDEX idx_opportunities_user_created ON opportunities(user_id, created_at DESC);
CREATE INDEX idx_opportunities_user_followup ON opportunities(user_id, next_followup_date);
```

**Description:** Job opportunities tracked by user in CRM.

**Columns:**
- `id`: Primary key
- `user_id`: Foreign key to users
- `company_name`: Company name (required)
- `position_title`: Job title (required)
- `recruiter_name`, `recruiter_email`: Recruiter contact info
- `job_description`: Full job description
- `status`: Current status (lead/applied/interview/offer/closed)
- `salary_min`, `salary_max`: Salary range
- `job_type`: Type of position
- `location`: Job location
- `remote_flexibility`: Remote work options
- `start_date`: Expected start date
- `source`: How user found opportunity
- `last_contact_date`: Last communication
- `next_followup_date`: Scheduled followup
- `notes`: User notes

---

### Table 6: Offer Comparisons

```sql
CREATE TABLE offer_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  decision_made BOOLEAN DEFAULT FALSE,
  selected_offer_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comparisons_user_id ON offer_comparisons(user_id);
CREATE INDEX idx_comparisons_created ON offer_comparisons(created_at DESC);
```

**Description:** Groups multiple offers for comparison.

**Columns:**
- `id`: Primary key
- `user_id`: Foreign key to users
- `title`: Custom comparison title
- `decision_made`: Whether user has decided
- `selected_offer_id`: Which offer was selected

---

### Table 7: Comparison Items

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
  remote_flexibility VARCHAR(50),
  contract_length_months INT,
  start_date DATE,
  total_compensation DECIMAL(12, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comparison_items_comparison ON comparison_items(comparison_id);
```

**Description:** Individual offers within a comparison.

**Columns:**
- `id`: Primary key
- `comparison_id`: Foreign key to offer_comparisons
- `company_name`, `position_title`: Offer details
- `salary`, `hourly_rate`: Compensation
- `signing_bonus`, `annual_bonus`: Additional cash
- `stock_options`: Stock details
- Benefits flags (boolean)
- `pto_days`: Paid time off days
- `commute_minutes`: Commute time
- `remote_flexibility`: Remote work option
- `contract_length_months`: Contract duration
- `start_date`: Start date
- `total_compensation`: Calculated total value
- `notes`: Additional notes

---

### Table 8: Refresh Tokens

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

**Description:** Valid refresh tokens for JWT authentication.

**Columns:**
- `id`: Primary key
- `user_id`: Foreign key to users
- `token_hash`: SHA-256 hash of token
- `expires_at`: Token expiration time
- `created_at`: Token creation time
- `is_revoked`: Revocation flag

---

### Table 9: Audit Logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

**Description:** Security and activity audit log.

**Columns:**
- `id`: Primary key
- `user_id`: User who performed action
- `action`: Action type (login, create_opportunity, etc.)
- `entity_type`: Type of entity affected
- `entity_id`: ID of entity affected
- `details`: JSON details of change
- `ip_address`: User's IP address
- `user_agent`: Browser user agent
- `created_at`: Timestamp

---

## Relationships Diagram

```
users
  ├── (1:N) messages
  │   └── (1:N) message_analyses
  │       └── (1:N) generated_replies
  ├── (1:N) opportunities
  ├── (1:N) offer_comparisons
  │   └── (1:N) comparison_items
  ├── (1:N) refresh_tokens
  └── (1:N) audit_logs
```

---

## Migration Strategy

### Phase 1: Initial Setup
1. Create all tables with primary keys and constraints
2. Create foreign keys
3. Create indexes for performance

### Phase 2: Data Integrity
1. Add check constraints
2. Add unique constraints
3. Add default values

### Phase 3: Performance
1. Analyze query patterns
2. Add additional indexes as needed
3. Set up query statistics

## Backup & Disaster Recovery

- Daily automated backups to AWS S3
- Point-in-time recovery enabled
- Backup retention: 30 days
- Test restore procedures monthly

## Performance Optimization

### Query Optimization
- All frequently filtered columns indexed
- Composite indexes for common joins
- Proper use of JSONB for semi-structured data

### Caching Strategy
- Cache user profiles (1 hour TTL)
- Cache opportunity lists (15 minutes TTL)
- Invalidate on write

### Archival Strategy
- Archive closed opportunities after 2 years
- Move old analyses to archive table
- Maintain referential integrity
