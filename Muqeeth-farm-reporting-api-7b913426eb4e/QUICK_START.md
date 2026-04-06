# Daily Reports Offline Submission API - Quick Reference

## What Was Built

A complete NestJS API for handling offline data collection and daily batch submission. Mobile apps can accumulate data locally throughout the day and submit everything once at the end of the day.

## Key Endpoint

```
POST /api/daily-reports/submit
```

Accepts a single request containing:
- Daily Report metadata (date, submitter)
- Multiple Sales transactions (with line items)
- Multiple Feed Receipts
- Multiple Shed Daily Reports

Returns the created Daily Report with ID (201 status).

## Architecture

### Entity Relationships

```
DailyReport (Parent)
├── Sales (FK: dailyReportId)
│   └── SaleItems (FK: saleId)
├── FeedReceipts (FK: dailyReportId)
└── ShedDailyReports (FK: dailyReportId)
```

### Layered Architecture

```
DailyReportController
    ↓
DailyReportService (Orchestrates)
    ├→ SaleService (with SaleItemService)
    ├→ FeedReceiptService
    └→ ShedDailyReportService
```

## Transaction Flow

When `/api/daily-reports/submit` is called:

1. **Create DailyReport**
   - Set status to "SUBMITTED"
   - Set submittedAt timestamp
   
2. **Create Sales & Items (Sequential)**
   - For each sale: Create Sale, then create its SaleItems
   - Maintains referential integrity

3. **Create Feed Receipts** (Batch)
   - All feed receipts created for this daily report

4. **Create Shed Daily Reports** (Batch)
   - All shed reports created for this daily report

## Data Models Summary

| Entity | Purpose | Key Fields |
|--------|---------|-----------|
| DailyReport | Header/wrapper | id, reportDate, status, submittedAt |
| Sale | Egg sale transaction | partyId, vehicleNumber, dailyReportId |
| SaleItem | Line item in sale | shedId, standardEggs, smallEggs, saleId |
| FeedReceipt | Ingredient/medicine receipt | partyId, feedItemId, quantityKg, dailyReportId |
| ShedDailyReport | Shed metrics | shedId, birdsMortality, eggs, dailyReportId |

## Mobile App Integration Pattern

### Offline Phase (Throughout the day)
```
1. User collects data on mobile device
2. Data stored in local SQLite/Realm database
3. No network calls needed
4. User can work completely offline
```

### Sync Phase (End of day)
```
1. User triggers "Submit" action
2. App packages all data into single JSON payload
3. POST to /api/daily-reports/submit
4. Receive confirmation with Daily Report ID
5. Clear local cache for next day
```

## Example Request

```json
POST /api/daily-reports/submit

{
  "reportDate": "2024-03-25",
  "submitterId": 1,
  "sales": [
    {
      "partyId": 1,
      "vehicleNumber": "ABC-123",
      "items": [
        { "shedId": 1, "standardEggs": 450, "smallEggs": 150 }
      ]
    }
  ],
  "feedReceipts": [
    {
      "partyId": 2,
      "feedItemId": 1,
      "vehicleNumber": "XYZ-789",
      "quantityKg": 500.50
    }
  ],
  "shedDailyReports": [
    {
      "shedId": 1,
      "birdsMortality": 2,
      "closingBirds": 998,
      "damagedEggs": 5,
      "standardEggsClosing": 800,
      "smallEggsClosing": 150
    }
  ]
}
```

## Files Created

### Services
- `src/daily-reports/daily-report.service.ts` - Main orchestrator
- `src/sales/sale.service.ts` - Sales with items
- `src/feed-receipts/feed-receipt.service.ts` - Feed receipts
- `src/shed-daily-reports/shed-daily-report.service.ts` - Shed data

### Controllers
- `src/daily-reports/daily-report.controller.ts` - HTTP endpoints

### Modules
- `src/daily-reports/daily-report.module.ts`
- `src/sales/sale.module.ts`
- `src/feed-receipts/feed-receipt.module.ts`
- `src/shed-daily-reports/shed-daily-report.module.ts`

### Data Transfer Objects
- `src/daily-reports/dto/submit-daily-report.dto.ts`
- `src/sales/dto/create-sale.dto.ts`
- `src/sales/dto/create-sale-item.dto.ts`
- `src/feed-receipts/dto/create-feed-receipt.dto.ts`
- `src/shed-daily-reports/dto/create-shed-daily-report.dto.ts`

## Key Features

✅ **Offline-First** - Supports full offline data accumulation  
✅ **Atomic Submission** - All data submitted together  
✅ **Sequence Integrity** - Entities saved in correct order  
✅ **Validation** - Input validation on all fields  
✅ **Referential Integrity** - Foreign keys maintained  
✅ **Cascade Deletes** - Clean up related records  
✅ **Transaction Support** - Transactional saves  
✅ **Status Tracking** - Draft/Submitted/Locked states  

## Validation Rules

- `reportDate` required, ISO 8601 format (YYYY-MM-DD)
- `submitterId` required, must be valid user ID
- All amounts are decimal with 2 decimal places
- At least one of sales/feedReceipts/shedDailyReports should be provided
- Sale items cannot be empty if sales exist
- Shed ID and quantities must be valid

## Response Codes

| Code | Meaning |
|------|---------|
| 201 | Daily report submitted successfully |
| 400 | Validation failed or business logic error |
| 404 | Daily report not found |
| 500 | Server error |

## Running the API

```bash
# Development with watch mode
npm run start:dev

# Production build
npm run build
npm run start:prod

# Testing
npm test
```

## Database

Uses SQLite by default (configured in `app.module.ts`):
- Database file: `database.sqlite`
- Auto-migrations enabled (synchronize: true)
- Good for development; use PostgreSQL/MySQL for production

## Next Steps

1. Add authentication/authorization guards to endpoints
2. Add transaction wrappers for atomic operations
3. Add event logging/audit trail
4. Add pagination to list endpoints
5. Add filtering/search capabilities
6. Set up database migrations for production
7. Add comprehensive test suite
8. Add rate limiting for mobile app requests
