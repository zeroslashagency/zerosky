# Zerosky POS - Implementation Plan

**Status:** Days 1-2 Complete | Days 3-7 In Progress  
**Target:** MVP Complete by 2026-07-28  
**Execution Mode:** Autonomous Loop with Multi-Agent Orchestration

---

## Completion Status

- [x] **Day 1:** Backend merged (auth, api, offline, payments, print) - 333 tests passing
- [x] **Day 2:** POS App Foundation (tRPC, auth context, layout) - VERIFIED & APPROVED
- [ ] **Day 3:** Authentication & Authorization
- [ ] **Day 4:** Menu Display & Management
- [ ] **Day 5:** Cart & Order Creation
- [ ] **Day 6:** KOT & Billing with GST
- [ ] **Day 7:** Payments & MVP Complete

---

## Day 3: Authentication & Authorization (NEXT)

**Goal:** Working login system with PIN and role-based access

**Agent Team:**
- Auth Specialist (lead)
- UI Engineer
- Security Reviewer

### Tasks

- [ ] **Task 3.1:** Full Login Flow (Email + Password)
  - Connect login page to tRPC auth.login mutation
  - Implement proper error handling
  - Store JWT tokens securely (httpOnly cookies or localStorage)
  - Redirect to dashboard on success
  - Handle loading and error states

- [ ] **Task 3.2:** PIN Login Implementation
  - Create PIN entry component (4-6 digit input)
  - Connect to tRPC auth.loginWithPin mutation
  - Auto-focus and keyboard navigation
  - Quick cashier login flow
  - PIN validation and error messages

- [ ] **Task 3.3:** Role-Based Access Control (RBAC)
  - Implement role checks in useAuth hook
  - Hide/show UI elements based on user role (OWNER, MANAGER, CASHIER, WAITER, KITCHEN)
  - Create <RequireRole> wrapper component
  - Test all 5 roles with different permissions

- [ ] **Task 3.4:** Session Management
  - Implement auto-refresh for access tokens
  - Handle token expiration gracefully
  - Session timeout warning (15 min idle)
  - Logout functionality (clear tokens, redirect to login)
  - Test token refresh flow

- [ ] **Task 3.5:** Security Review
  - Verify tokens stored securely
  - Check for XSS vulnerabilities
  - Verify CSRF protection
  - Check rate limiting on login endpoints
  - Security audit report

**Acceptance Criteria:**
- ✅ Can login with email + password
- ✅ Can login with PIN (4-6 digits)
- ✅ Tokens stored securely
- ✅ Protected routes work correctly
- ✅ Role-based UI elements show/hide properly
- ✅ Session refresh works automatically
- ✅ Security review passed

---

## Day 4: Menu Display & Management

**Goal:** Browse and search menu items

**Agent Team:**
- Data Engineer (lead)
- UI Engineer
- UX Reviewer

### Tasks

- [ ] **Task 4.1:** Menu Data Layer
  - Call tRPC menu.getCategories query
  - Call tRPC menu.getItems with filters
  - Implement search functionality
  - Setup react-query caching

- [ ] **Task 4.2:** Category Navigation
  - Create category tabs/pills component
  - Filter items by selected category
  - Show item count per category
  - Active category highlighting

- [ ] **Task 4.3:** Item Display Grid
  - Create ItemCard component with:
    - Image thumbnail
    - Name and description
    - Price (₹ formatted)
    - Availability badge
    - GST rate indicator
  - Responsive grid (2-3-4 columns)
  - Hover effects and animations

- [ ] **Task 4.4:** Search & Filters
  - Search by item name (real-time)
  - Filter by: vegetarian, price range, availability
  - Clear filters button
  - Empty state for no results

**Acceptance Criteria:**
- ✅ Menu items load from backend
- ✅ Categories display correctly
- ✅ Item cards show all info
- ✅ Search works in real-time
- ✅ Filters apply correctly
- ✅ Responsive on tablet/desktop

---

## Day 5: Cart & Order Creation

**Goal:** Add items to cart and create orders

**Agent Team:**
- State Engineer (lead)
- UI Engineer
- Integration Engineer

### Tasks

- [ ] **Task 5.1:** Cart State Management
  - Create useCart() hook with Zustand or Context
  - Add item to cart
  - Update quantity (+ / -)
  - Remove item
  - Clear cart
  - Calculate subtotal, tax, total

- [ ] **Task 5.2:** Cart UI Component
  - Cart sidebar/panel
  - Item list with quantity controls
  - Modifier tags display
  - Remove button per item
  - Cart summary (subtotal, tax, total)
  - Empty cart state

- [ ] **Task 5.3:** Modifiers & Customization
  - Modifier selection modal
  - Single-select options (size: S/M/L)
  - Multi-select options (add-ons)
  - Item notes textarea
  - Apply modifiers to cart item

- [ ] **Task 5.4:** Order Creation
  - Table selection UI
  - Call tRPC order.create mutation
  - Send order to kitchen
  - Success confirmation
  - Clear cart after order
  - Handle errors

**Acceptance Criteria:**
- ✅ Can add items to cart
- ✅ Quantity updates work
- ✅ Modifiers can be selected
- ✅ Item notes work
- ✅ Cart calculates totals correctly
- ✅ Order creates successfully in database
- ✅ Cart clears after order

---

## Day 6: KOT & Billing with GST

**Goal:** Generate KOT and bills with proper GST breakdown

**Agent Team:**
- Print Engineer (lead)
- GST Specialist
- UI Engineer

### Tasks

- [ ] **Task 6.1:** KOT Generation
  - Call tRPC kot.create mutation
  - KOT format with order details
  - Print to thermal printer (58mm/80mm)
  - Print preview component
  - Priority/rush order flag

- [ ] **Task 6.2:** GST Calculator
  - Create calculateGST() utility
  - Detect customer state (intra vs inter-state)
  - Calculate CGST + SGST (intra-state)
  - Calculate IGST (inter-state)
  - Apply correct rates: 0%, 5%, 12%, 18%
  - Handle GST-inclusive vs exclusive

- [ ] **Task 6.3:** Bill Preview Component
  - Restaurant info (name, address, GSTIN)
  - Bill number and date
  - Table number
  - Itemized list with quantities
  - Subtotal
  - GST breakdown (CGST/SGST/IGST)
  - Service charge
  - Discount
  - Grand total
  - Print and PDF export buttons

- [ ] **Task 6.4:** Discount Application
  - Apply flat discount (₹ amount)
  - Apply percentage discount
  - Manager approval for > 10%
  - Update bill total
  - Record discount reason

**Acceptance Criteria:**
- ✅ KOT prints correctly
- ✅ GST calculates accurately for all rates
- ✅ Bill shows complete breakdown
- ✅ Discount applies correctly
- ✅ Receipt format is print-ready
- ✅ GST compliance verified

---

## Day 7: Payments & MVP Complete

**Goal:** Accept payments and complete orders (MVP READY!)

**Agent Team:**
- Payment Engineer (lead)
- Razorpay Specialist
- QA Engineer

### Tasks

- [ ] **Task 7.1:** Payment Screen
  - Show final bill amount
  - Payment method selector (CASH, CARD, UPI)
  - Razorpay integration for CARD + UPI
  - Cash input with change calculation

- [ ] **Task 7.2:** Multi-Tender Support
  - Split payment between methods
  - Track payment breakdown
  - Validate total = bill amount
  - Visual split indicator

- [ ] **Task 7.3:** Payment Confirmation
  - Call tRPC payment.create mutation
  - Verify with Razorpay webhook (CARD/UPI)
  - Mark order as PAID
  - Print receipt
  - Success message

- [ ] **Task 7.4:** Order Completion
  - Update status to COMPLETED
  - Clear table assignment
  - Archive order
  - Return to dashboard

- [ ] **Task 7.5:** End-to-End Testing
  - Test complete flow: Login → Menu → Cart → KOT → Bill → Payment → Complete
  - Test all payment methods (Cash, Card, UPI)
  - Test edge cases (empty cart, out of stock, payment failure)
  - Multi-user scenarios
  - GST calculation verification
  - Performance testing
  - Security audit

**Acceptance Criteria:**
- ✅ All payment methods work
- ✅ Multi-tender splits correctly
- ✅ Razorpay integration works (NO Zomato/Swiggy)
- ✅ Change calculation correct
- ✅ Receipt prints successfully
- ✅ Order completes and archives
- ✅ Full flow works end-to-end
- ✅ All 333+ tests passing
- ✅ 0 TypeScript errors
- ✅ Security review passed
- ✅ **🎉 MVP COMPLETE!**

---

## Quality Gates (Every Task)

- ✅ Code compiles without errors
- ✅ All tests pass (existing + new)
- ✅ TypeScript strict mode passes
- ✅ No console errors/warnings
- ✅ Functional requirements met
- ✅ Peer review passed (different agent)

---

## Out of Scope (Deferred)

- ❌ Zomato/Swiggy UPI integration
- ❌ Partnership features
- ❌ Inventory management
- ❌ Reporting & analytics
- ❌ Multi-location management
- ❌ Customer CRM

---

## Reference Documents

- `AUTONOMOUS_BUILD_PLAN.md` - Complete 7-day plan
- `AGENT_TEAM_SPEC.md` - Agent roles and coordination
- `DAY2_COMPLETION_REPORT.md` - Day 2 deliverables
- `DAY2_QA_VERIFICATION_REPORT.md` - QA verification

---

**Last Updated:** 2026-07-23 (Day 2 complete)  
**Next Action:** Start Day 3 - Authentication & Authorization
