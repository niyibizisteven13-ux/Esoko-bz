# Trader Oversight & Suspend/Activate Configuration

## Issues Found & Fixed

### 1. ✅ Duplicate `/api/admin/traders` Endpoints
**Problem**: Two trader endpoints existed - one comprehensive with detailed stats, one basic
**Solution**: Removed duplicate basic endpoint at line 3151, kept enhanced endpoint with full trader details

**Endpoint**: `GET /api/admin/traders` (requireRole: admin)
```typescript
// Features:
- Filters traders by role = 'trader'
- Includes transaction stats (volume, count, customers)
- Includes fee collection data
- Includes KYC verification status
- Supports optional status filtering via ?status=active|suspended
```

### 2. ✅ Missing Status Display in Trade Oversight
**Problem**: Traders were fetched but their account status wasn't displayed
**Solution**: Enhanced AdminTraders component to display account status badge

**Status Indicators**:
- 🟢 Active (green badge)
- 🔴 Suspended (red badge)
- ⚠️ KYC Status (pending/verified/not_started)

### 3. ✅ No Status Filtering in Trade Oversight
**Problem**: Couldn't filter traders by suspension status
**Solution**: Added filter buttons in AdminTraders UI
```
- All Traders (shows all with role='trader')
- Active (shows only status='active')
- Suspended (shows only status='suspended')
```

### 4. ✅ Suspend/Activate Functionality Working
**Implementation Details**:
- API Endpoint: `PUT /api/admin/users/:id` with `{ status: 'active' | 'suspended' }`
- Database Field: `users.status` (TEXT DEFAULT 'active')
- Email Notifications: Sent on suspension and reactivation
- Response: Returns updated user object via `publicUser(updatedUser)`

## Configuration Verified

### Database Schema
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
-- Values: 'active', 'suspended'
```

### API Endpoints

#### Get All Users (includes traders)
```
GET /api/admin/users?search=...&role=...
Response: { success: true, users: [] }
```

#### Get Traders Only
```
GET /api/admin/traders?status=active|suspended
Response: { success: true, traders: [], total: number }

Trader Object:
{
  id, email, name, phone, role, tier, walletBalance,
  status: 'active' | 'suspended',  // NEW FIELD
  businessName, businessCategory, location,
  verificationStatus, emailVerified,
  verification: { status, kycStatus, businessVerified },
  stats: { totalTransactions, totalVolume, totalCustomers },
  fees: { totalCollected, transactionCount }
}
```

#### Suspend/Activate User
```
PUT /api/admin/users/:id
Body: { status: 'suspended' | 'active' }
Response: { success: true, user: publicUser(updatedUser) }

Triggers:
- Suspension email sent if changing to 'suspended'
- Reactivation email sent if changing to 'active'
- Admin action logged for audit trail
```

## Frontend Features

### User Management (AdminUsers)
- Search users by name, phone, email, business name
- Display columns: User, Role, Status (with visual indicator), Joined, Actions
- Actions: View, Suspend/Activate
- Status shows: 🟢 Active | 🔴 Suspended

### Trade Oversight (AdminTraders)
- Filter buttons: All Traders | Active | Suspended
- Display trader cards with:
  - Basic info (name, location, business, tier)
  - Account status badge
  - KYC status badge
  - Transaction statistics (volume, count, customers)
  - Fee collection summary
  - Verification details (email, KYC, business)

## Why Traders Appear in Both Views

**This is INTENTIONAL and CORRECT**:

1. **User Management** (admin/users)
   - Shows: ALL users of any role
   - Purpose: General user administration
   - Includes: Traders, Customers, Agents, Managers, Admins
   - Actions: View details, suspend/activate, change role, adjust wallet

2. **Trade Oversight** (admin/traders)
   - Shows: ONLY users with role = 'trader'
   - Purpose: Monitor trader-specific activity
   - Includes: Transaction stats, KYC verification, fee collection
   - Actions: View detailed trader metrics, monitor suspension status

## Configuration Checklist

- [x] Status column exists in users table
- [x] Suspend/activate endpoint working
- [x] Trader endpoint returns complete trader details
- [x] Status filtering implemented in API
- [x] Status filtering UI added to Trade Oversight
- [x] Status display badges added to both views
- [x] Email notifications on suspension/reactivation
- [x] Admin action logging implemented
- [x] Duplicate endpoints removed

## Testing Procedures

### Test Suspend/Activate Flow
1. Go to User Management
2. Search for any trader account
3. Click "View" to see trader details
4. Click "Suspend" button
5. Verify:
   - Status changes to "Suspended"
   - Red badge appears
   - Suspension email sent
   - Trader can't login (verify in auth service)

### Test Trade Oversight Filtering
1. Go to Trade Oversight
2. Click "All Traders" button
3. Verify all traders listed (active + suspended)
4. Click "Active" button
5. Verify only active traders shown
6. Click "Suspended" button
7. Verify only suspended traders shown

### Test Reactivation
1. Go to Trade Oversight, filter "Suspended"
2. Go back to User Management, find suspended trader
3. Click "Activate" button
4. Verify:
   - Status changes to "Active"
   - Green badge appears
   - Reactivation email sent
   - Trader can login again

## Future Enhancements

1. **Bulk Actions**: Suspend/activate multiple traders at once
2. **Suspension Reasons**: Add reason field when suspending
3. **Suspension Timeline**: Show suspension history and duration
4. **Auto-Reactivation**: Schedule automatic reactivation after period
5. **Suspension Notifications**: Notify trader support team
6. **Compliance Integration**: Link suspensions to compliance rules

---

# Trader Business Oversight & Subscription Management

## Overview

The Trader Oversight system provides comprehensive business intelligence and subscription management capabilities to help traders improve their business performance through data-driven insights and controlled feature access.

## Core Features

### 1. Business Analytics Dashboard

#### Trader Performance Metrics
- **Revenue Analytics**: Monthly/quarterly revenue trends, growth rates, seasonal patterns
- **Customer Acquisition**: New customer growth, retention rates, customer lifetime value
- **Transaction Volume**: Daily/weekly transaction counts, average transaction values
- **Geographic Performance**: Sales by location, delivery zones, market penetration
- **Product Performance**: Best-selling items, inventory turnover, profit margins

#### Comparative Analysis
- **Peer Benchmarking**: Compare trader performance against similar businesses
- **Market Trends**: Industry-wide trends, competitor analysis, market share
- **Historical Performance**: Year-over-year growth, seasonal adjustments

### 2. Business Analyst Integration

#### Analyst Assignment System
```
API Endpoint: POST /api/admin/traders/:id/assign-analyst
Body: { analystId: string, priority: 'low'|'medium'|'high', requirements: string }
```

#### Analyst Dashboard Features
- **Trader Profiles**: Complete business overview, performance metrics, pain points
- **Recommendation Engine**: AI-powered suggestions for business improvement
- **Action Plans**: Structured improvement plans with timelines and KPIs
- **Progress Tracking**: Monitor implementation of recommendations

#### Communication System
- **Secure Messaging**: Encrypted communication between analysts and traders
- **Report Sharing**: Share detailed business reports and insights
- **Video Consultations**: Schedule virtual meetings for in-depth analysis

### 3. Subscription & Feature Management

#### Subscription Tiers
```typescript
interface SubscriptionTier {
  id: string;
  name: string; // 'Starter', 'Professional', 'Enterprise'
  price: number;
  features: string[];
  limits: {
    transactionsPerMonth: number;
    storageGB: number;
    apiCallsPerDay: number;
    supportLevel: 'basic'|'priority'|'dedicated';
  };
  activationKey: string;
}
```

#### Feature Activation Keys
- **Dynamic Feature Control**: Enable/disable features based on subscription
- **Graduated Access**: Unlock advanced features as business grows
- **Trial Periods**: Time-limited feature access for evaluation
- **Custom Configurations**: Tailored feature sets for specific business needs

#### Subscription Management API
```
GET /api/admin/subscriptions
POST /api/admin/subscriptions
PUT /api/admin/subscriptions/:id
DELETE /api/admin/subscriptions/:id

GET /api/admin/traders/:id/subscription
PUT /api/admin/traders/:id/subscription
POST /api/admin/traders/:id/activation-key
```

### 4. Business Model Control Center

#### Dynamic Fee Management
```typescript
interface FeeStructure {
  transactionFees: {
    percentage: number; // 0.5% to 5%
    fixedAmount: number; // RWF 10-500
    tiers: {
      tier: 'free'|'basic'|'premium';
      percentage: number;
    }[];
  };
  walletFees: {
    depositFee: number;
    withdrawalFee: number;
    transferFee: number;
    currencyConversionFee: number;
  };
  subscriptionFees: {
    monthlyBase: number;
    perTransaction: number;
    premiumFeatures: number;
  };
}
```

#### Real-time Fee Adjustment
- **Market-based Pricing**: Adjust fees based on market conditions
- **Volume Discounts**: Reduce fees for high-volume traders
- **Promotional Pricing**: Temporary fee reductions for campaigns
- **Geographic Variations**: Different fees for different regions

#### Control Center API
```
GET /api/admin/business-model
PUT /api/admin/business-model/fees
PUT /api/admin/business-model/subscriptions
POST /api/admin/business-model/promotions
GET /api/admin/business-model/analytics
```

## Database Schema Extensions

### New Tables

#### subscriptions
```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  currency TEXT DEFAULT 'RWF',
  features TEXT, -- JSON array of feature IDs
  limits TEXT, -- JSON object with limits
  activation_key TEXT UNIQUE,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### trader_subscriptions
```sql
CREATE TABLE trader_subscriptions (
  id TEXT PRIMARY KEY,
  trader_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'expired', 'cancelled'
  activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  auto_renew BOOLEAN DEFAULT 0,
  payment_method TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trader_id) REFERENCES users(id),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);
```

#### business_analysts
```sql
CREATE TABLE business_analysts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  specialization TEXT, -- 'retail', 'wholesale', 'logistics', 'finance'
  experience_years INTEGER,
  certifications TEXT, -- JSON array
  rating REAL DEFAULT 5.0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### analyst_assignments
```sql
CREATE TABLE analyst_assignments (
  id TEXT PRIMARY KEY,
  trader_id TEXT NOT NULL,
  analyst_id TEXT NOT NULL,
  status TEXT DEFAULT 'assigned', -- 'assigned', 'in_progress', 'completed', 'cancelled'
  priority TEXT DEFAULT 'medium',
  requirements TEXT,
  deadline DATETIME,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (trader_id) REFERENCES users(id),
  FOREIGN KEY (analyst_id) REFERENCES business_analysts(id)
);
```

#### dynamic_fees
```sql
CREATE TABLE dynamic_fees (
  id TEXT PRIMARY KEY,
  fee_type TEXT NOT NULL, -- 'transaction', 'wallet_deposit', 'subscription'
  percentage REAL,
  fixed_amount REAL,
  conditions TEXT, -- JSON: min_amount, max_amount, user_tier, etc.
  is_active BOOLEAN DEFAULT 1,
  effective_from DATETIME DEFAULT CURRENT_TIMESTAMP,
  effective_to DATETIME,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

## Frontend Components

### Trader Oversight Dashboard
- **Business Metrics Cards**: Revenue, customers, transactions, growth
- **Performance Charts**: Trend lines, comparisons, forecasts
- **Analyst Recommendations**: Actionable insights and advice
- **Subscription Status**: Current plan, features, renewal date

### Subscription Management Panel
- **Tier Comparison**: Feature matrix across subscription levels
- **Activation Key Generator**: Create and manage feature keys
- **Usage Monitoring**: Track feature utilization and limits
- **Upgrade/Downgrade Flows**: Seamless plan changes

### Business Model Control Center
- **Fee Configuration**: Sliders and inputs for all fee types
- **Real-time Impact Analysis**: Preview revenue impact of changes
- **A/B Testing**: Test different fee structures
- **Automated Adjustments**: AI-driven fee optimization

## Implementation Roadmap

### Phase 1: Core Analytics (Week 1-2)
- [ ] Extend trader endpoint with business metrics
- [ ] Create analytics dashboard UI
- [ ] Add performance comparison features

### Phase 2: Analyst Integration (Week 3-4)
- [ ] Business analyst user roles
- [ ] Assignment and communication system
- [ ] Recommendation tracking

### Phase 3: Subscription System (Week 5-6)
- [ ] Subscription tier management
- [ ] Feature activation keys
- [ ] Payment integration

### Phase 4: Control Center (Week 7-8)
- [ ] Dynamic fee management
- [ ] Business model analytics
- [ ] Automated optimization

## Security Considerations

### Data Privacy
- **Anonymized Analytics**: Aggregate data without PII
- **Access Controls**: Role-based access to sensitive business data
- **Audit Logging**: Track all analyst assignments and recommendations

### Feature Access Control
- **Key Validation**: Secure activation key verification
- **Subscription Enforcement**: Automatic feature disabling on expiration
- **Grace Periods**: Temporary access during payment processing

### Financial Security
- **Fee Change Auditing**: Log all fee structure modifications
- **Revenue Impact Analysis**: Validate fee changes don't break business model
- **Rollback Capabilities**: Emergency rollback for problematic changes

---

**Last Updated**: May 5, 2026
**Status**: 🚧 In Development
