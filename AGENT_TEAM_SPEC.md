# 🤖 Agent Team Specification for Zerosky POS

**Purpose:** Define agent roles, responsibilities, communication protocols, and quality gates for autonomous MVP execution.

---

## 👥 Agent Team Structure

### Orchestrator (Primary Controller)

**Role:** Master coordinator and quality gatekeeper

**Responsibilities:**
- Assign daily tasks to specialized agents
- Review all deliverables against quality gates
- Coordinate handoffs between agents
- Resolve conflicts and blockers
- Maintain timeline and progress tracking
- Final approval on all merges

**Tools:**
- `/agent-team-orchestration` skill
- `spawn_subagent` for task delegation
- Git for code review
- Documentation tracking

**Success Metrics:**
- All 7 days completed on schedule
- Zero critical bugs in MVP
- 100% quality gate compliance

---

### Frontend Architect (Days 2, 4, 5)

**Role:** UI/UX design and component architecture

**Responsibilities:**
- Design app routing structure
- Create reusable component patterns
- Establish design system (colors, spacing, typography)
- Define state management strategy
- Review UI/UX consistency

**Deliverables:**
- App layout with navigation
- Component library structure
- Design tokens and theme
- Routing configuration

**Quality Gates:**
- Components are reusable and typed
- Responsive design (mobile, tablet, desktop)
- Accessibility standards (WCAG AA)
- Clean component hierarchy

**Communication:**
- Reports to: Orchestrator
- Collaborates with: UI Engineer, UX Reviewer
- Hands off to: Integration Engineer (after structure is ready)

---

### Integration Engineer (Days 2, 5)

**Role:** Backend-frontend integration specialist

**Responsibilities:**
- Setup tRPC client with typed router
- Configure API endpoints and proxy
- Implement data fetching patterns
- Handle loading/error states
- Optimize caching strategy

**Deliverables:**
- tRPC client configuration
- React Query setup
- API integration helpers
- Error boundary components

**Quality Gates:**
- Type safety end-to-end (frontend → backend)
- Proper error handling
- Loading states implemented
- Cache invalidation working

**Communication:**
- Reports to: Orchestrator
- Depends on: Backend packages (@zerosky/api)
- Collaborates with: Frontend Architect
- Hands off to: Feature engineers (auth, menu, cart)

---

### Auth Specialist (Day 3)

**Role:** Authentication and authorization implementation

**Responsibilities:**
- Implement login flows (email + PIN)
- Setup JWT token management
- Create protected route middleware
- Implement RBAC (role-based access control)
- Session management with auto-refresh

**Deliverables:**
- Login page (email + password)
- PIN login component
- Auth context/hooks (`useAuth`)
- Protected route wrapper
- Session refresh logic

**Quality Gates:**
- Tokens stored securely (httpOnly cookies)
- RBAC working for all 5 roles
- Session timeout handled gracefully
- No auth bypass vulnerabilities
- Security review passed

**Communication:**
- Reports to: Orchestrator
- Depends on: Integration Engineer (tRPC setup)
- Reviewed by: Security Reviewer
- Hands off to: All feature agents (auth is foundational)

---

### UI Engineer (Days 2-7)

**Role:** Build UI components and screens

**Responsibilities:**
- Implement shadcn/ui components
- Build feature screens (menu, cart, bill, payment)
- Implement responsive layouts
- Add animations and transitions
- Ensure accessibility

**Deliverables:**
- Menu display with categories and items
- Cart sidebar with item management
- Bill preview with GST breakdown
- Payment screen with method selection
- Kitchen display view

**Quality Gates:**
- All components typed (TypeScript)
- Responsive on all screen sizes
- Keyboard navigation works
- ARIA labels present
- Visual consistency

**Communication:**
- Reports to: Frontend Architect
- Collaborates with: All feature engineers
- Reviewed by: UX Reviewer
- Hands off to: QA Engineer (for testing)

---

### State Engineer (Day 5)

**Role:** State management and data flow

**Responsibilities:**
- Design cart state management
- Implement Zustand/Context for global state
- Handle optimistic updates
- Manage form state
- Implement undo/redo if needed

**Deliverables:**
- `useCart()` hook with full cart operations
- Cart state persistence (localStorage)
- Cart calculations (subtotal, tax, total)
- State synchronization with backend

**Quality Gates:**
- State updates are predictable
- No unnecessary re-renders
- State persists across page refresh
- Race conditions handled

**Communication:**
- Reports to: Orchestrator
- Collaborates with: UI Engineer, Integration Engineer
- Hands off to: UI Engineer (for cart UI)

---

### Print Engineer (Day 6)

**Role:** Printing and KOT generation

**Responsibilities:**
- Generate KOT (Kitchen Order Ticket)
- Format bills and receipts
- Implement ESC/POS commands
- Support 58mm and 80mm printers
- Generate print previews

**Deliverables:**
- KOT generation with proper format
- Bill/receipt templates
- Print preview component
- ESC/POS byte generation
- PDF export option

**Quality Gates:**
- KOT prints correctly (verified with @zerosky/print package)
- Bill format matches legal requirements
- Thermal printer compatibility (58mm/80mm)
- Print queue handles failures

**Communication:**
- Reports to: Orchestrator
- Depends on: @zerosky/print package (114 tests)
- Collaborates with: GST Specialist
- Reviewed by: QA Engineer

---

### GST Specialist (Day 6)

**Role:** GST calculation and tax compliance

**Responsibilities:**
- Implement GST calculator
- Handle CGST + SGST (intra-state)
- Handle IGST (inter-state)
- Apply correct tax rates (0%, 5%, 12%, 18%)
- Verify tax compliance

**Deliverables:**
- `calculateGST()` utility function
- Bill breakdown component
- Tax rate configuration
- GST report generation

**Quality Gates:**
- GST calculations mathematically correct
- CGST + SGST = IGST (when applicable)
- Tax rates match Indian GST slabs
- Compliance verified against legal requirements
- Test coverage for all edge cases

**Communication:**
- Reports to: Orchestrator
- Collaborates with: Print Engineer, UI Engineer
- Reviewed by: Compliance Reviewer (if available)
- Hands off to: QA Engineer (for verification)

---

### Payment Engineer (Day 7)

**Role:** Payment processing and Razorpay integration

**Responsibilities:**
- Implement payment screen
- Integrate Razorpay SDK
- Handle multi-tender payments
- Calculate change for cash payments
- Verify payment status

**Deliverables:**
- Payment method selector (Cash, Card, UPI)
- Razorpay integration (Card + UPI only)
- Multi-tender split logic
- Change calculator
- Payment confirmation flow

**Quality Gates:**
- All payment methods work
- Multi-tender splits correctly
- Razorpay webhook verified
- Payment failures handled gracefully
- **NO Zomato/Swiggy integration** (out of scope)

**Communication:**
- Reports to: Orchestrator
- Depends on: @zerosky/payments package (81 tests)
- Collaborates with: Razorpay Specialist
- Hands off to: QA Engineer (for E2E testing)

---

### QA Engineer (Days 3-7, Lead on Day 7)

**Role:** Testing, verification, quality assurance

**Responsibilities:**
- Write and run unit tests
- Write integration tests
- Run E2E tests (Playwright)
- Verify all quality gates
- Test edge cases and error scenarios
- Multi-user testing

**Deliverables:**
- Test suite for all new features
- E2E test scenarios
- Bug reports
- Quality gate verification reports
- Performance benchmarks

**Quality Gates:**
- All tests pass (333 + new)
- 80%+ test coverage maintained
- No console errors
- Performance metrics met (<3s load, <500ms API)
- E2E flow works end-to-end

**Communication:**
- Reports to: Orchestrator
- Reviews: All deliverables from all agents
- Collaborates with: All agents
- Final sign-off on: MVP readiness

---

### Security Reviewer (Day 3, Final Review)

**Role:** Security audit and vulnerability assessment

**Responsibilities:**
- Review authentication implementation
- Check for common vulnerabilities (XSS, CSRF, injection)
- Verify token storage security
- Check CORS configuration
- Review rate limiting

**Deliverables:**
- Security audit report
- Vulnerability assessment
- Recommendations for fixes
- Sign-off on security posture

**Quality Gates:**
- No critical vulnerabilities
- Auth implementation secure
- Token storage secure (httpOnly cookies)
- Rate limiting working
- CORS properly configured

**Communication:**
- Reports to: Orchestrator
- Reviews: Auth Specialist deliverables
- Blocks merge: If critical vulnerabilities found

---

### UX Reviewer (Days 4-7)

**Role:** Usability and user experience review

**Responsibilities:**
- Review UI for usability
- Check mobile responsiveness
- Verify accessibility
- Test keyboard navigation
- Review user flows

**Deliverables:**
- UX review reports
- Usability recommendations
- Accessibility audit
- User flow validation

**Quality Gates:**
- All screens are usable
- Mobile responsive
- Keyboard navigation works
- ARIA labels present
- User flows are intuitive

**Communication:**
- Reports to: Orchestrator
- Reviews: UI Engineer deliverables
- Collaborates with: Frontend Architect

---

## 📋 Daily Workflow

### Morning (Start of Each Day)

**Orchestrator Actions:**
1. Review previous day's completed tasks
2. Verify all quality gates passed
3. Identify any blockers
4. Assign tasks for current day
5. Spawn specialized agents with clear instructions

**Agent Actions:**
1. Review task assignment
2. Check dependencies (what needs to be ready first)
3. Pull latest code from `main`
4. Create feature branch
5. Start work

---

### During Day (Continuous)

**Agent Actions:**
1. Work on assigned deliverables
2. Write tests alongside code
3. Commit frequently with meaningful messages
4. Update progress in task tracking
5. Ask questions if blocked

**Orchestrator Actions:**
1. Monitor progress
2. Answer questions
3. Resolve blockers
4. Coordinate handoffs between agents
5. Spot-check quality during development

---

### Evening (End of Each Day)

**Agent Actions:**
1. Complete all deliverables
2. Run tests locally (all must pass)
3. Run typecheck (must be clean)
4. Open PR with description
5. Request review from orchestrator

**Orchestrator Actions:**
1. Review all PRs
2. Check quality gates (tests, types, functionality)
3. Request changes if needed
4. Merge approved PRs
5. Update progress tracking
6. Prepare next day's plan

**Quality Gate Verification:**
- ✅ Code compiles without errors
- ✅ All tests pass (existing + new)
- ✅ TypeScript strict mode passes
- ✅ No console errors/warnings
- ✅ Functional requirements met
- ✅ Peer review passed (different agent)

---

## 🔄 Handoff Protocol

### Handoff Process

When Agent A completes work that Agent B depends on:

1. **Agent A (Sender):**
   - Completes deliverables
   - Runs all quality checks
   - Merges PR to `main`
   - Creates handoff document with:
     - What was completed
     - What Agent B needs to know
     - Any gotchas or limitations
     - Example usage

2. **Orchestrator (Coordinator):**
   - Verifies handoff is complete
   - Tags Agent B
   - Provides handoff document
   - Confirms Agent B understands

3. **Agent B (Receiver):**
   - Reads handoff document
   - Pulls latest code
   - Verifies dependencies work
   - Asks clarification questions
   - Starts work

### Example Handoffs

**Integration Engineer → Auth Specialist:**
```
✅ tRPC client is setup at lib/trpc.ts
✅ Providers wrapper is at app/providers.tsx
✅ Example query: trpc.auth.login.useMutation()
✅ API URL configured in .env.local
⚠️ Note: Wrap all client components with Providers
```

**Auth Specialist → All Feature Agents:**
```
✅ useAuth() hook available at hooks/useAuth.ts
✅ <ProtectedRoute> wrapper available
✅ Check user.role for RBAC (OWNER, MANAGER, CASHIER, WAITER, KITCHEN)
✅ Tokens auto-refresh, handle errors in your queries
⚠️ Note: Always check loading state before accessing user
```

---

## 🚨 Escalation Protocol

### When to Escalate to Orchestrator

**Immediate Escalation (Blocker):**
- Dependency not ready
- Critical bug found
- Test failures blocking progress
- Security vulnerability discovered
- Architecture decision needed

**Daily Escalation (Question):**
- Clarification on requirements
- Ambiguity in design
- Performance concern
- Scope question

**End-of-Day Escalation (Risk):**
- Won't finish on time
- Quality gate might fail
- Technical debt concern
- Refactor needed

### Escalation Format

```
ESCALATION: [BLOCKER|QUESTION|RISK]
Agent: [Your Agent Name]
Day: [Current Day Number]
Issue: [One-line summary]

Details:
[What's wrong, what you tried, what you need]

Impact:
[How this affects timeline/quality]

Recommendation:
[What you think should be done]
```

---

## ✅ Quality Gates (Per Deliverable)

### Code Quality Gates

- ✅ **TypeScript:** No errors, strict mode passes
- ✅ **Tests:** All pass, new features have tests
- ✅ **Coverage:** 80%+ maintained
- ✅ **Linting:** No errors (when ESLint configured)
- ✅ **Formatting:** Prettier applied
- ✅ **No Dead Code:** Unused imports removed
- ✅ **No TODOs:** Complete implementation only

### Functional Quality Gates

- ✅ **Requirements:** All acceptance criteria met
- ✅ **Edge Cases:** Handled (empty states, errors)
- ✅ **Loading States:** Implemented for async operations
- ✅ **Error Handling:** User-friendly error messages
- ✅ **Validation:** Input validation where needed

### Design Quality Gates

- ✅ **Responsive:** Works on tablet/desktop
- ✅ **Keyboard Nav:** All interactive elements accessible
- ✅ **ARIA:** Labels present for screen readers
- ✅ **Contrast:** WCAG AA (4.5:1)
- ✅ **Consistency:** Matches design system

### Security Quality Gates

- ✅ **Auth:** Tokens stored securely
- ✅ **Validation:** All inputs validated
- ✅ **XSS:** No innerHTML with user data
- ✅ **CSRF:** Protected (if using forms)
- ✅ **Rate Limiting:** Enabled for sensitive endpoints

---

## 📊 Progress Tracking

### Daily Status Update Format

```markdown
## Day X Progress - [Date]

### Completed ✅
- [Deliverable 1] - Agent Name
- [Deliverable 2] - Agent Name

### In Progress 🔨
- [Deliverable 3] - Agent Name (60% complete)
- [Deliverable 4] - Agent Name (30% complete)

### Blocked 🚨
- [Deliverable 5] - Agent Name - Waiting on [dependency]

### Next Day Plan 📅
- [Deliverable 6] - Agent Name
- [Deliverable 7] - Agent Name

### Quality Metrics
- Tests: 333 → 350 (+17 new)
- Coverage: 85% (maintained)
- TypeScript Errors: 0
- Build Status: ✅ Green
```

---

## 🎯 Success Criteria (MVP Complete)

### Day 7 Final Checklist

**Functional:**
- ✅ Complete order flow works (login → order → payment)
- ✅ All payment methods work (Cash, Card, UPI)
- ✅ KOT prints correctly
- ✅ Bill with GST breakdown correct
- ✅ Multi-user roles working

**Technical:**
- ✅ All tests pass (333+ tests)
- ✅ 0 TypeScript errors
- ✅ 80%+ test coverage
- ✅ Build completes successfully
- ✅ No console errors

**Quality:**
- ✅ All quality gates passed
- ✅ Security review passed
- ✅ Accessibility audit passed
- ✅ Performance benchmarks met
- ✅ Documentation complete

**Sign-off Required:**
- ✅ QA Engineer: E2E tests passed
- ✅ Security Reviewer: No critical vulnerabilities
- ✅ UX Reviewer: Usability verified
- ✅ Orchestrator: Final approval

---

## 📝 Agent Communication Guidelines

### Do's ✅

- **Be specific:** "Menu items not loading" not "API broken"
- **Provide context:** Include error messages, stack traces
- **Suggest solutions:** Don't just report problems
- **Update status:** Keep orchestrator informed
- **Ask questions:** Better to clarify than assume
- **Document decisions:** Record why you chose approach X

### Don'ts ❌

- **Don't assume:** Verify before implementing
- **Don't skip tests:** Write tests for new code
- **Don't merge broken code:** All quality gates must pass
- **Don't work in isolation:** Communicate with team
- **Don't ignore warnings:** TypeScript warnings matter
- **Don't leave TODOs:** Complete implementation or defer

---

## 🚀 Ready to Execute

**Orchestrator:** Use this spec to coordinate agents

**Agents:** Follow your role's responsibilities and quality gates

**Communication:** Use handoff protocol for dependencies

**Quality:** Every deliverable must pass all gates

**Timeline:** 7 days to MVP (2026-07-23 → 2026-07-28)

**Let's build this autonomously! 🤖**
