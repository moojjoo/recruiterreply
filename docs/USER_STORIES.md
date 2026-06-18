# User Stories - RecruiterReply.com MVP

## Epic 1: User Authentication & Onboarding

### US1.1: User Registration
**As a** job seeker  
**I want to** create an account with email and password  
**So that** I can access RecruiterReply and track my opportunities

**Acceptance Criteria:**
- [ ] User can enter email, password, and confirm password
- [ ] System validates email format
- [ ] System validates password strength (min 8 chars, uppercase, number, special char)
- [ ] User receives confirmation email
- [ ] Account is created after email confirmation
- [ ] User is redirected to login after registration

**Technical Notes:**
- Password hashing with bcrypt
- Email verification token with 24-hour expiration

---

### US1.2: User Login
**As a** registered user  
**I want to** log in with my email and password  
**So that** I can access my account and data

**Acceptance Criteria:**
- [ ] User can enter email and password
- [ ] System validates credentials
- [ ] Valid login returns JWT token
- [ ] User is redirected to dashboard
- [ ] Token is stored in secure storage
- [ ] Invalid credentials show error message

**Technical Notes:**
- JWT token expires in 24 hours
- Refresh token valid for 30 days
- Remember me option (future)

---

### US1.3: User Logout
**As a** logged-in user  
**I want to** log out of my account  
**So that** my session is terminated and my data is secure

**Acceptance Criteria:**
- [ ] User can click logout button
- [ ] Session tokens are invalidated
- [ ] User is redirected to login page
- [ ] Local storage is cleared
- [ ] Refresh token is revoked

---

### US1.4: Password Reset
**As a** user who forgot their password  
**I want to** reset my password via email  
**So that** I can regain access to my account

**Acceptance Criteria:**
- [ ] User can request password reset
- [ ] Reset link is sent to email
- [ ] Link expires after 1 hour
- [ ] User can set new password
- [ ] Old sessions are invalidated
- [ ] Confirmation email is sent

---

## Epic 2: Message Analysis

### US2.1: Analyze Recruiter Message
**As a** job seeker  
**I want to** analyze a recruiter's email  
**So that** I understand the opportunity and identify potential issues

**Acceptance Criteria:**
- [ ] User can paste email body and optionally subject
- [ ] System extracts sender information
- [ ] AI provides competitiveness score (1-10)
- [ ] AI evaluates compensation vs market rates
- [ ] AI identifies red flags
- [ ] Results display in clear format
- [ ] Analysis is saved to history

**Business Rules:**
- Competitiveness score: based on position, level, location
- Red flags: unrealistic promises, vague compensation, pressure tactics
- Market rate comparison: against industry standards

**Technical Notes:**
- OpenAI API call with structured prompt
- Response parsing and validation
- Database persistence

---

### US2.2: View Analysis History
**As a** job seeker  
**I want to** view all my previous message analyses  
**So that** I can refer back to opportunities

**Acceptance Criteria:**
- [ ] User sees list of all analyses
- [ ] List shows newest first
- [ ] Each item shows company, position, date
- [ ] User can filter by date range
- [ ] User can search by company name
- [ ] User can click to view full analysis
- [ ] User can delete old analyses

**Technical Notes:**
- Pagination for large lists
- Database query optimization with indexes
- Filtering and sorting

---

### US2.3: View Single Analysis Detail
**As a** job seeker  
**I want to** view detailed analysis of a specific recruiter message  
**So that** I can review the complete assessment

**Acceptance Criteria:**
- [ ] Full message is displayed
- [ ] Competitiveness score highlighted
- [ ] Compensation evaluation shown with visualization
- [ ] Red flags listed with explanations
- [ ] Suggested tone displayed
- [ ] Generate reply option available
- [ ] Related replies shown

---

## Epic 3: Reply Generation

### US3.1: Generate Reply to Recruiter
**As a** job seeker  
**I want to** generate professional replies to recruiter messages  
**So that** I can respond quickly and professionally

**Acceptance Criteria:**
- [ ] User can select reply type (interested, decline, counteroffer, followup)
- [ ] System generates multiple reply options
- [ ] Replies are professional and contextual
- [ ] User can regenerate if unsatisfied
- [ ] User can copy reply to clipboard
- [ ] Replies are saved to history
- [ ] User can edit generated reply

**Reply Types:**
- **Interested**: Express interest, ask for details
- **Decline**: Polite rejection with reason
- **Counteroffer**: Counter salary/terms
- **Follow-up**: Check status, request timeline

**Technical Notes:**
- OpenAI GPT-4 for generation
- Prompt engineering for quality responses
- Multiple response caching

---

### US3.2: Edit Generated Reply
**As a** job seeker  
**I want to** customize generated replies  
**So that** they match my communication style

**Acceptance Criteria:**
- [ ] User can edit generated reply
- [ ] Tone suggestions available
- [ ] Real-time character count
- [ ] Save edited version
- [ ] Undo option available
- [ ] Preview formatting

---

### US3.3: Copy Reply to Clipboard
**As a** job seeker  
**I want to** easily copy generated reply  
**So that** I can paste it into email

**Acceptance Criteria:**
- [ ] Copy button visible
- [ ] Click copies full reply text
- [ ] Success notification shown
- [ ] Works on mobile devices

---

## Epic 4: Offer Comparison

### US4.1: Create New Offer Comparison
**As a** job seeker with multiple offers  
**I want to** compare job offers side-by-side  
**So that** I can make an informed decision

**Acceptance Criteria:**
- [ ] User can create new comparison
- [ ] Comparison has a custom title
- [ ] User can add multiple offers
- [ ] Offer form captures:
  - Company name
  - Position title
  - Salary/hourly rate
  - Signing bonus
  - Annual bonus
  - Stock options
  - Benefits (health, dental, vision, 401k)
  - PTO days
  - Remote flexibility
  - Start date
  - Contract length
  - Notes
- [ ] User can save comparison

**Validation Rules:**
- Company and position are required
- At least one compensation field required
- Start date must be in future
- PTO days must be positive number

---

### US4.2: View Offer Comparison
**As a** job seeker  
**I want to** see comparison results  
**So that** I can evaluate offers quantitatively

**Acceptance Criteria:**
- [ ] Offers displayed side-by-side
- [ ] Total compensation calculated
- [ ] Benefits matrix shown
- [ ] Pros/cons list generated
- [ ] Recommendation highlighted
- [ ] Comparison saved
- [ ] Comparison shareable (future)

**Calculation Rules:**
- Total comp = Salary + (Signing Bonus / 4 years) + (Annual Bonus * 0.75) + Stock value
- Benefits valued: each major benefit = ~$5,000/year
- Remote flexibility weighted by hours saved commuting

---

### US4.3: Manage Comparisons
**As a** job seeker  
**I want to** manage my saved offer comparisons  
**So that** I can review them anytime

**Acceptance Criteria:**
- [ ] List all saved comparisons
- [ ] Edit existing comparison
- [ ] Delete comparison
- [ ] Search comparisons by company
- [ ] Sort by date created
- [ ] Export comparison (future)

---

## Epic 5: Candidate CRM

### US5.1: Create New Opportunity
**As a** job seeker  
**I want to** create a new opportunity record  
**So that** I can track all my job prospects

**Acceptance Criteria:**
- [ ] Form captures:
  - Company name (required)
  - Position title (required)
  - Recruiter name and email
  - Job description
  - Status (dropdown)
  - Salary range
  - Job type (full-time, contract, part-time)
  - Location
  - Remote flexibility
  - Start date
  - Source of opportunity
  - Notes
- [ ] Required fields validated
- [ ] Opportunity saved to database
- [ ] User redirected to view opportunity

**Status Values:**
- Lead (initial contact)
- Applied (application submitted)
- Interview (in interview process)
- Offer (offer received)
- Closed (accepted, declined, or ghosted)

---

### US5.2: View All Opportunities
**As a** job seeker  
**I want to** see all my opportunities in one place  
**So that** I can manage my job search

**Acceptance Criteria:**
- [ ] List view showing all opportunities
- [ ] Kanban board view by status
- [ ] Each card shows: company, position, status, date
- [ ] Sort options: by date, by status, by company
- [ ] Filter options: by status, by company, by salary range
- [ ] Search by company or position
- [ ] Pagination for large lists
- [ ] Switch between list and kanban views

---

### US5.3: View Opportunity Detail
**As a** job seeker  
**I want to** see full details of an opportunity  
**So that** I can review all information

**Acceptance Criteria:**
- [ ] All opportunity fields displayed
- [ ] Related analyses shown (if applicable)
- [ ] Related comparisons shown (if applicable)
- [ ] Communication history (future)
- [ ] Edit button available
- [ ] Delete button available
- [ ] Status change dropdown

---

### US5.4: Update Opportunity
**As a** job seeker  
**I want to** update opportunity details  
**So that** information stays current

**Acceptance Criteria:**
- [ ] User can edit all fields
- [ ] Changes saved to database
- [ ] Last updated timestamp shown
- [ ] Confirmation before save
- [ ] Cancel option available

---

### US5.5: Change Opportunity Status
**As a** job seeker  
**I want to** update opportunity status  
**So that** I know where each opportunity stands

**Acceptance Criteria:**
- [ ] Status dropdown available
- [ ] Status transitions guided (lead → applied → interview → offer → closed)
- [ ] Status change triggers actions:
  - Interview status: can set next followup date
  - Offer status: can create comparison
  - Closed status: can mark reason
- [ ] Status change logged
- [ ] Timeline updated

---

### US5.6: Set Follow-up Reminder
**As a** job seeker  
**I want to** set follow-up reminders  
**So that** I don't miss opportunities

**Acceptance Criteria:**
- [ ] User can set next followup date
- [ ] Reminder notification sent at scheduled time
- [ ] Multiple reminders possible per opportunity
- [ ] Email notification option
- [ ] In-app notification shown
- [ ] Snooze option available

---

### US5.7: Delete Opportunity
**As a** job seeker  
**I want to** delete opportunities  
**So that** I can clean up closed or unwanted leads

**Acceptance Criteria:**
- [ ] Delete button available
- [ ] Confirmation required
- [ ] Opportunity archived (not hard deleted)
- [ ] Can view archived opportunities (future)
- [ ] Can restore archived opportunity (future)

---

## Epic 6: User Profile & Settings

### US6.1: View User Profile
**As a** logged-in user  
**I want to** view my profile information  
**So that** I can verify my account details

**Acceptance Criteria:**
- [ ] Profile page displays:
  - Email
  - First name
  - Last name
  - Profile picture
  - Account created date
  - Last login date
  - Account status
- [ ] Profile picture preview shown

---

### US6.2: Update Profile
**As a** logged-in user  
**I want to** update my profile information  
**So that** my account reflects current information

**Acceptance Criteria:**
- [ ] User can edit name and email
- [ ] User can upload profile picture
- [ ] Changes saved to database
- [ ] Confirmation message shown
- [ ] Email change triggers verification (future)
- [ ] Picture is optimized and stored

---

## Epic 7: Notifications & Reminders

### US7.1: Email Notifications
**As a** job seeker  
**I want to** receive email notifications  
**So that** I stay informed about important events

**Notification Types:**
- Follow-up reminders
- Password reset
- Account activity
- Feature updates (future)

**Acceptance Criteria:**
- [ ] Notifications sent at correct time
- [ ] User can disable notifications (future)
- [ ] Unsubscribe option in email
- [ ] HTML email templates

---

## Story Points & Priority

| Story | Points | Priority | Sprint |
|-------|--------|----------|--------|
| US1.1 | 5 | High | 1 |
| US1.2 | 5 | High | 1 |
| US1.3 | 2 | High | 1 |
| US1.4 | 5 | Medium | 2 |
| US2.1 | 8 | High | 1 |
| US2.2 | 5 | Medium | 2 |
| US2.3 | 3 | Medium | 2 |
| US3.1 | 8 | High | 1 |
| US3.2 | 3 | Medium | 2 |
| US3.3 | 2 | Medium | 2 |
| US4.1 | 8 | High | 1 |
| US4.2 | 5 | High | 1 |
| US4.3 | 3 | Medium | 2 |
| US5.1 | 5 | High | 1 |
| US5.2 | 5 | High | 1 |
| US5.3 | 3 | Medium | 2 |
| US5.4 | 3 | Medium | 2 |
| US5.5 | 3 | Medium | 2 |
| US5.6 | 5 | Medium | 2 |
| US5.7 | 2 | Low | 2 |
| US6.1 | 2 | Low | 2 |
| US6.2 | 3 | Low | 2 |
| US7.1 | 5 | Medium | 2 |

**Total MVP Points: 104**

## Acceptance Criteria Checklist

Each story should be tested against its acceptance criteria before marking complete. QA should verify all criteria are met on staging before production deployment.
