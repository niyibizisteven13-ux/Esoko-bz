# Admin Portal Quick Reference

## User Management Section

### Features
- Search users by name, phone, email, or business name
- View all users across all roles
- Suspend/Activate individual users
- Change user roles on the fly
- Adjust wallet balances
- View detailed user information including:
  - KYC and verification status
  - Wallet balance and transaction history
  - Fee collection breakdown
  - Account creation and verification dates

### Suspend/Activate Flow
```
User Status: Active → Click "Suspend" → Suspended (red)
User Status: Suspended → Click "Activate" → Active (green)
```

### Key Information Displayed
- User Info: Name, Email, Phone
- Role Badge: Customer (blue), Trader (orange), Manager (purple), Admin (red), Agent (blue)
- Status: Active ✓ / Suspended ✗
- Verification: Verified / Pending
- Wallet Balance: Current RWF amount
- Account Age: Joined date

---

## Trade Oversight Section

### Features
- **Filter Traders**: All | Active | Suspended
- View complete trader profiles including:
  - Business information (name, category, location)
  - Transaction statistics (volume, count, customers served)
  - Fee collection summary
  - KYC verification status
  - Email verification status
  - Account status

### Trader Status Indicators
- 🟢 Green Badge: Account is ACTIVE
- 🔴 Red Badge: Account is SUSPENDED
- 🟡 Yellow Badge: KYC PENDING
- 🔵 Blue Badge: KYC VERIFIED

### Trader Metrics
- **Total Transactions**: Number of trades completed
- **Transaction Volume**: Total RWF amount traded
- **Customers Served**: Number of unique customers
- **Fees Collected**: Total platform fees collected from trader

### Verification Status
- Email: ✓ Verified / ✗ Pending
- KYC: Not Started / Pending / Verified
- Business: ✓ Verified / ✗ Pending

---

## Perfect Configuration Rules

### ✅ Correct Behavior

1. **User appears in User Management** - Correct for ALL users
   - All traders show here
   - All customers show here
   - All admins/managers/agents show here
   - This is the master user list

2. **Trader appears in Trade Oversight** - Correct ONLY when role = 'trader'
   - Filters to role='trader' exclusively
   - Shows detailed trader metrics
   - Allows monitoring trader activity

3. **Suspended Trader**
   - Still appears in User Management (to manage suspension)
   - Can be filtered in Trade Oversight (by clicking "Suspended" button)
   - Cannot login or perform transactions
   - Shows as red/suspended in both views

4. **Newly Registered Trader**
   - Appears in User Management immediately
   - Appears in Trade Oversight (active filter)
   - Initially status='active' and verificationStatus='pending'
   - Can login but may have limited features pending verification

### ❌ Issues to Watch For

- ❌ Trader missing from User Management → Data integrity issue
- ❌ Trader missing from Trade Oversight when status='active' → Query filter issue
- ❌ Can't toggle suspension → API or button event issue
- ❌ Wrong role color badge → Role value incorrect in database
- ❌ No email on suspension → SMTP configuration issue

---

## Common Workflows

### Workflow: Suspend a Problem Trader

1. Go to **User Management**
2. Search for trader name
3. Click **"View"** button to see details
4. Click **"Suspend"** button (red)
5. Confirm in popup
6. ✓ Status changes to "Suspended" (red badge)
7. ✓ Suspension email sent to trader
8. ✓ Trader cannot login or create transactions

### Workflow: Reactivate a Trader

1. Go to **Trade Oversight**
2. Click **"Suspended"** filter button
3. Find trader card
4. (Option A) Click trader in card to view in User Management, then click "Activate"
5. (Option B) Go to User Management, search for trader, click "Activate"
6. ✓ Status changes to "Active" (green badge)
7. ✓ Reactivation email sent to trader
8. ✓ Trader can login again

### Workflow: Review Active Traders

1. Go to **Trade Oversight**
2. Click **"Active"** filter button
3. View all active traders with:
   - Transaction volume
   - Customer count
   - Fee collection
   - Verification status
4. Click trader card to see detailed metrics

### Workflow: Monitor Trader Performance

1. Go to **Trade Oversight**
2. View **Trading Statistics** for each trader:
   - Total Transactions: Business activity level
   - Transaction Volume: Business size/revenue
   - Customers Served: Market reach
3. View **Fees Collected**: Platform revenue from trader
4. Monitor KYC status for compliance

---

## Database View (for reference)

### User Status Values
```
status='active'    → User can login and perform actions
status='suspended' → User cannot login, all transactions blocked
```

### User Role Values
```
role='customer' → Can purchase, has wallet
role='trader'   → Can sell products, manage shop
role='agent'    → Can manage others, process transactions
role='manager'  → Can view analytics, manage team
role='admin'    → Full system access, can suspend users
```

### User Verification Values
```
verificationStatus='pending'  → Awaiting verification
verificationStatus='verified' → Account verified
verificationStatus='rejected' → Verification failed
```

---

## Troubleshooting

### Issue: Trader not appearing in Trade Oversight

**Causes**:
1. Trader account has role ≠ 'trader'
   - Fix: In User Management, view trader, change role to 'trader'
2. Trader account suspended and filter set to 'Active'
   - Fix: Click 'Suspended' button to see suspended traders
3. Database query error
   - Check: Server logs for SQL errors
   - Fix: Restart server and refresh page

### Issue: Can't suspend trader

**Causes**:
1. Not logged in as admin
   - Fix: Verify you have admin role
2. Network issue
   - Fix: Check browser console for errors
3. Backend error
   - Fix: Check server logs, restart if needed

### Issue: Suspension email not sent

**Causes**:
1. SMTP not configured
   - Check: .env file for SMTP_USER, SMTP_PASS, etc.
   - Fix: Configure SMTP in .env
2. Email address invalid
   - Check: User's email field in database
   - Fix: Update email in User Management
3. Email service error
   - Check: Server logs for email errors
   - Fix: May need to restart email service

---

## Settings to Verify

From Admin Portal → Platform Config:

- [ ] Maintenance Mode: OFF (unless under maintenance)
- [ ] Registration Open: ON (to allow new users)
- [ ] Free Plan Fee Rate: 0.006 (0.6%)
- [ ] Premium Plan Fee Rate: 0.003 (0.3%)

---

Generated: 2026-05-04
Version: 1.0
