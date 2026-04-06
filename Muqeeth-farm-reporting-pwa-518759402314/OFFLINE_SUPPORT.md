# Flygoog PWA - Offline Support Implementation

## Overview

The PWA now has complete offline support for daily report submissions. Users can collect data from multiple pages, persist it locally with localStorage, and submit it when connectivity is available. Data is automatically organized by report date and survives app restarts.

## Architecture

### 1. Core Context: `DailyReportDraftContext`

**Location**: `lib/daily-report-draft-context.tsx`

Manages the state of daily report drafts with automatic localStorage synchronization.

**Structure**:
```typescript
DailyReportDraft {
  reportDate: string;
  sales: CreateSaleDto[];
  feedReceipts: CreateFeedReceiptDto[];
  shedDailyReports: CreateShedDailyReportDto[];
}
```

**Key Methods**:
- `loadDraft(date)` - Load or create draft for a specific date
- `updateSales(sales)` - Update sales entries for current date
- `updateFeedReceipts(receipts)` - Update feed receipts for current date
- `updateShedDailyReports(reports)` - Update shed reports for current date
- `getSubmitDto(submitterId)` - Build complete SubmitDailyReportDto for submission
- `clearDraft()` - Clear draft after successful submission

**Storage**:
- Uses localStorage key: `"dailyReportDrafts"`
- Stores all drafts by date for historical access
- Auto-persists on every update

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Main Page (page.tsx)                       │
│  - Date selector (default: today)                           │
│  - Displays completion status for each section              │
│  - Submit button (enabled when all sections have data)      │
└─────────────────────────────────────────────────────────────┘
        │
        ├─ /sales-entry?date=YYYY-MM-DD
        │  ├─ Display draft sales entries
        │  └─ /add-entry → Save → Back
        │
        ├─ /feed-plant-entry?date=YYYY-MM-DD
        │  ├─ Display draft feed entries
        │  └─ /add-entry → Save → Back
        │
        └─ /shed-data-entry?date=YYYY-MM-DD
           ├─ Display all sheds with data fields
           ├─ Click to edit in bottom sheet
           └─ Save → Updates draft
```

---

## Pages Implementation

### Main Dashboard: `app/page.tsx`

**Features**:
- Date picker (allows selecting past/future dates)
- Real-time completion status based on draft data
- Automatic draft loading when date changes
- Submit button that:
  - Constructs SubmitDailyReportDto with all data
  - Calls API via `submitDailyReport(dto)`
  - Shows success/error alerts
  - Clears draft on success
  - Resets to today's date

**Integration**:
```typescript
const { draft, loadDraft, clearDraft } = useDailyReportDraft();
const { user } = useAuth();

// When date changes
useEffect(() => {
  loadDraft(date);
}, [date]);

// On submit
const handleSubmit = async () => {
  const submitDto = {
    reportDate: draft.reportDate,
    submitterId: parseInt(user.id),
    sales: draft.sales,
    feedReceipts: draft.feedReceipts,
    shedDailyReports: draft.shedDailyReports,
  };
  await submitDailyReport(submitDto);
  clearDraft();
};
```

---

### Sales Entry: `app/sales-entry/`

**Main Page** (`page.tsx`):
- Lists all draft sales entries
- Shows entry count
- Each entry displays:
  - Party name (from parties reference data)
  - Vehicle number
  - Total standard eggs (sum of all sheds)
  - Total small eggs (sum of all sheds)
  - Delete button

**Add Entry** (`add-entry/page.tsx`):
- Party selector
- Vehicle number input
- Multiple shed entries (add/remove sheds):
  - Shed selector
  - Standard eggs quantity
  - Small eggs quantity
- Creates `CreateSaleDto`:
  ```typescript
  {
    partyId: number;
    vehicleNumber: string;
    items: CreateSaleItemDto[];
  }
  ```

---

### Feed Plant Entry: `app/feed-plant-entry/`

**Main Page** (`page.tsx`):
- Lists all draft feed receipts
- Shows entry count
- Each entry displays:
  - Party name
  - Feed item name
  - Vehicle number
  - Quantity (kg)
  - Delete button

**Add Entry** (`add-entry/page.tsx`):
- Party selector
- Feed item selector
- Vehicle number input
- Quantity selector (kg)
- Creates `CreateFeedReceiptDto`:
  ```typescript
  {
    partyId: number;
    feedItemId: number;
    vehicleNumber: string;
    quantityKg: number;
  }
  ```

---

### Shed Data Entry: `app/shed-data-entry/page.tsx`

**Unique Implementation**:
- No add/edit sub-page (inline editing via bottom sheet)
- Displays all sheds from reference data
- Click any shed row to edit
- Edit fields in bottom sheet:
  - Birds Mortality
  - Closing Birds
  - Damaged Eggs
  - Standard Eggs Closing
  - Small Eggs Closing
  - Total Feed Receipt (optional)

**Data Structure** (`CreateShedDailyReportDto`):
```typescript
{
  shedId: number;
  birdsMortality: number;
  closingBirds: number;
  damagedEggs: number;
  standardEggsClosing: number;
  smallEggsClosing: number;
  totalFeedReceipt?: number;
}
```

---

## Data Persistence

### localStorage Key Structure
```
dailyReportDrafts: {
  "2024-01-15": { reportDate, sales, feedReceipts, shedDailyReports },
  "2024-01-16": { reportDate, sales, feedReceipts, shedDailyReports },
  ...
}
```

### When Data is Saved
1. ✅ Automatically on every state update (updateSales, updateFeedReceipts, updateShedDailyReports)
2. ✅ Survives page refresh
3. ✅ Survives app close/reopen
4. ✅ One draft per date (replacement, not accumulation)

### When Data is Cleared
- Only when user successfully submits via the Submit button
- Manually via `clearDraft()` (clears current date's draft)

---

## Usage Flow

### Scenario 1: Basic Workflow (Single Day)

1. **Open App**
   - Default to today's date
   - Load today's draft (empty initially)

2. **Add Sales**
   - Click "Sales Entry" → Links to `/sales-entry?date=2024-01-15`
   - Click "Add Entry"
   - Select party, vehicle, enter shed/eggs data
   - Save → Returned to sales list
   - Repeat as needed

3. **Add Feed**
   - Click "Feed Plant Entry" → Links to `/feed-plant-entry?date=2024-01-15`
   - Click "Add Entry"
   - Select party, item, vehicle, quantity
   - Save → Returned to feed list
   - Repeat as needed

4. **Enter Shed Data**
   - Click "Shed Data Entry" → Links to `/shed-data-entry?date=2024-01-15`
   - Click any shed row
   - Enter data in bottom sheet
   - Save
   - Repeat for all sheds

5. **Submit**
   - All sections now have data ✓
   - "Submit Report" button is enabled
   - Click to submit
   - API call sends all data
   - On success: Draft cleared, notification shown

### Scenario 2: Multi-Day Workflow

1. **Day 1 - Start Report**
   - Enter partial data for 2024-01-15
   - Data auto-saves to localStorage
   - Close app

2. **Day 1 - Later Session**
   - Reopen app
   - App automatically loads 2024-01-15 draft
   - Data is intact
   - Continue from where you left off

3. **Day 2 - New Report**
   - Change date picker to 2024-01-16
   - Fresh, empty draft loads
   - Enter data for new date
   - Data persists separately

4. **Day 3 - Finish Previous Day**
   - Change date to 2024-01-15
   - Previous day's data is restored
   - Complete and submit
   - Draft cleared

### Scenario 3: Offline to Online

1. **In Offline Mode**
   - User fills in all data
   - Data persists in localStorage
   - Submit button shows error but data is preserved

2. **Connection Restored**
   - User can retry submit
   - All cached data is still available
   - Submit succeeds

---

## API Integration

### Submit Endpoint

**Function**: `submitDailyReport(dto: SubmitDailyReportDto)`  
**File**: `lib/api.ts`  
**Method**: POST  
**Endpoint**: `/api/daily-reports/submit`

**DTO Structure**:
```typescript
{
  reportDate: string;        // ISO date: YYYY-MM-DD
  submitterId: number;       // User ID from auth context
  sales: CreateSaleDto[];
  feedReceipts: CreateFeedReceiptDto[];
  shedDailyReports: CreateShedDailyReportDto[];
}
```

**Error Handling** (in main page):
```typescript
try {
  await submitDailyReport(submitDto);
  clearDraft();
  alert("Report submitted successfully!");
  setDate(today); // Reset to today
} catch (error) {
  console.error("Failed to submit:", error);
  alert("Failed to submit. Data has been saved locally.");
}
```

---

## Provider Setup

**Location**: `app/providers.tsx`

```typescript
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppDataProvider>
        <DailyReportDraftProvider>
          {children}
        </DailyReportDraftProvider>
      </AppDataProvider>
    </AuthProvider>
  );
}
```

**Nesting Order** (Important):
1. AuthProvider (user authentication)
2. AppDataProvider (reference data: sheds, parties, feedItems)
3. DailyReportDraftProvider (daily report drafts)

---

## Hooks Usage

### In Components

```typescript
// Import
import { useDailyReportDraft } from '@/lib/daily-report-draft-context';
import { useSearchParams } from 'next/navigation';

// In component
const { draft, loadDraft, updateSales } = useDailyReportDraft();
const searchParams = useSearchParams();
const date = searchParams.get('date') || today;

// Load draft when date changes
useEffect(() => {
  loadDraft(date);
}, [date]);

// Update sales
const handleAddSale = (sale) => {
  const updated = [...(draft?.sales || []), sale];
  updateSales(updated);
};
```

---

## Testing Scenarios

### ✅ Test Case 1: Offline Persistence
1. Open app, add sales data
2. Close browser tab/app
3. Reopen app
4. Data should still be visible

### ✅ Test Case 2: Date Switching
1. Add data for 2024-01-15
2. Change date to 2024-01-16
3. Should see empty form
4. Add different data for 2024-01-16
5. Switch back to 2024-01-15
6. Original data should be restored

### ✅ Test Case 3: Completion Status
1. Start with empty form
2. "Submit Report" button should be disabled (grayed out)
3. Add sales data → "Submit Report" still disabled
4. Add feed data → "Submit Report" still disabled
5. Add shed data → "Submit Report" now enabled (highlighted)

### ✅ Test Case 4: Delete Entry
1. Add sales entry
2. Click delete icon
3. Entry removed from list
4. Refresh page
5. Entry should still be deleted (verified delete worked)

### ✅ Test Case 5: Submit Flow
1. Complete all three sections (sales, feed, shed)
2. Click "Submit Report"
3. Should show "Submitting..." 
4. On success: alert shown, draft cleared
5. Return to main page with empty form

---

## Future Enhancements

Potential features for v2:
- Edit entries (currently only delete + re-add)
- Draft history (view all submitted reports)
- Sync indicator (show if data is pending sync)
- Batch operations (delete all entries of a type)
- Data export/import
- Offline sync queue
- Conflict resolution for multi-device edits

---

## Troubleshooting

**Q: Data not persisting after app close?**  
A: Check browser's localStorage is enabled. Clear browser cache and try again.

**Q: Date picker not working?**  
A: Ensure `useSearchParams` hook is available in your Next.js version (≥13.0.0).

**Q: Submit button disabled when data exists?**  
A: Verify all three sections (sales, feed, shed) have at least one entry each.

**Q: Draft not updating when I add entries?**  
A: Check browser console for errors. Verify DailyReportDraftProvider is in layout.

**Q: Multiple users on same device?**  
A: Current implementation stores all drafts in browser localStorage. Multi-user support would require user- specific keys or IndexedDB with user separation.
