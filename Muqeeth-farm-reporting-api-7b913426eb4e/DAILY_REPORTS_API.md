# Daily Reports API Documentation

## Overview
This API allows mobile apps to collect offline data (daily reports, sales, feed receipts, shed data) and submit everything at once daily.

## API Endpoint

### Submit Daily Report
**POST** `/api/daily-reports/submit`

Submit a complete daily report with all related business objects (Sales, Sale Items, Feed Receipts, and Shed Data).

#### Request Headers
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

#### Request Body Structure

```json
{
  "reportDate": "2024-03-25",
  "submitterId": 1,
  "sales": [...],
  "feedReceipts": [...],
  "shedDailyReports": [...]
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reportDate` | string (ISO 8601) | Yes | Date of the report in YYYY-MM-DD format |
| `submitterId` | number | Yes | User ID of the person submitting the report |
| `sales` | array | No | Array of sales transactions |
| `feedReceipts` | array | No | Array of feed receipts |
| `shedDailyReports` | array | No | Array of shed daily report data |

---

## Data Models

### Sales Object
Contains sales information with line items.

```json
{
  "partyId": 1,
  "vehicleNumber": "ABC-123",
  "items": [
    {
      "shedId": 1,
      "standardEggs": 100,
      "smallEggs": 50
    }
  ]
}
```

**Fields:**
- `partyId` (number, required): Customer party ID
- `vehicleNumber` (string, optional): Vehicle registration number
- `items` (array, required): Array of sale items for this transaction

**Sale Item Fields:**
- `shedId` (number, required): Shed ID
- `standardEggs` (number, optional, default: 0): Quantity of standard eggs
- `smallEggs` (number, optional, default: 0): Quantity of small eggs

---

### Feed Receipt Object
Contains feed/ingredient receipt information.

```json
{
  "partyId": 2,
  "feedItemId": 1,
  "vehicleNumber": "XYZ-789",
  "quantityKg": 500.50
}
```

**Fields:**
- `partyId` (number, required): Supplier party ID
- `feedItemId` (number, required): Feed item ID (ingredient or medicine)
- `vehicleNumber` (string, optional): Vehicle registration number
- `quantityKg` (number, required): Quantity in kilograms (decimal precision: 2)

---

### Shed Daily Report Object
Contains daily metrics for a specific shed.

```json
{
  "shedId": 1,
  "birdsMortality": 2,
  "closingBirds": 998,
  "damagedEggs": 5,
  "standardEggsClosing": 800,
  "smallEggsClosing": 150,
  "totalFeedReceipt": 25.50
}
```

**Fields:**
- `shedId` (number, required): Shed ID
- `birdsMortality` (number, optional): Number of birds that died
- `closingBirds` (number, optional): Total birds at end of day
- `damagedEggs` (number, optional): Count of damaged eggs
- `standardEggsClosing` (number, optional): Standard eggs closing count
- `smallEggsClosing` (number, optional): Small eggs closing count
- `totalFeedReceipt` (number, optional): Total feed received in kg (decimal precision: 2)

---

## Complete Example

### Request

```bash
curl -X POST http://localhost:3000/api/daily-reports/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "reportDate": "2024-03-25",
    "submitterId": 1,
    "sales": [
      {
        "partyId": 1,
        "vehicleNumber": "MH-02-AB-1234",
        "items": [
          {
            "shedId": 1,
            "standardEggs": 450,
            "smallEggs": 150
          },
          {
            "shedId": 2,
            "standardEggs": 400,
            "smallEggs": 100
          }
        ]
      },
      {
        "partyId": 3,
        "vehicleNumber": "MH-02-CD-5678",
        "items": [
          {
            "shedId": 1,
            "standardEggs": 200,
            "smallEggs": 50
          }
        ]
      }
    ],
    "feedReceipts": [
      {
        "partyId": 2,
        "feedItemId": 1,
        "vehicleNumber": "MH-02-EF-9012",
        "quantityKg": 500.50
      },
      {
        "partyId": 2,
        "feedItemId": 2,
        "vehicleNumber": "MH-02-EF-9012",
        "quantityKg": 100.25
      }
    ],
    "shedDailyReports": [
      {
        "shedId": 1,
        "birdsMortality": 2,
        "closingBirds": 998,
        "damagedEggs": 5,
        "standardEggsClosing": 800,
        "smallEggsClosing": 150,
        "totalFeedReceipt": 250.50
      },
      {
        "shedId": 2,
        "birdsMortality": 1,
        "closingBirds": 999,
        "damagedEggs": 3,
        "standardEggsClosing": 750,
        "smallEggsClosing": 120,
        "totalFeedReceipt": 200.00
      }
    ]
  }'
```

### Response (Success 201)

```json
{
  "id": 1,
  "reportDate": "2024-03-25",
  "createdByUserId": 1,
  "status": "SUBMITTED",
  "submittedAt": "2024-03-25T10:30:00.000Z",
  "createdAt": "2024-03-25T10:30:00.000Z",
  "updatedAt": "2024-03-25T10:30:00.000Z"
}
```

---

## Other Endpoints

### Get All Daily Reports
**GET** `/daily-reports`

Returns list of all daily reports ordered by date (newest first).

**Response:**
```json
[
  {
    "id": 1,
    "reportDate": "2024-03-25",
    "createdByUserId": 1,
    "status": "SUBMITTED",
    "submittedAt": "2024-03-25T10:30:00.000Z",
    "createdAt": "2024-03-25T10:30:00.000Z",
    "updatedAt": "2024-03-25T10:30:00.000Z",
    "createdByUser": {...}
  }
]
```

### Get Daily Report Details
**GET** `/daily-reports/{id}`

Returns a specific daily report with all related sales, feed receipts, and shed daily reports.

**Response:**
```json
{
  "id": 1,
  "reportDate": "2024-03-25",
  "createdByUserId": 1,
  "status": "SUBMITTED",
  "submittedAt": "2024-03-25T10:30:00.000Z",
  "createdAt": "2024-03-25T10:30:00.000Z",
  "updatedAt": "2024-03-25T10:30:00.000Z",
  "createdByUser": {...},
  "sales": [...],
  "feedReceipts": [...],
  "shedDailyReports": [...]
}
```

---

## Data Saving Sequence

When a daily report is submitted, data is saved in the following sequence to maintain referential integrity:

1. **DailyReport** - Created/Updated with SUBMITTED status
2. **Sales** - Created for the daily report
3. **SaleItems** - Created for each sale (dependent on Sales)
4. **FeedReceipts** - Created for the daily report
5. **ShedDailyReports** - Created for the daily report

---

## Status Values

The `DailyReport` entity has the following status values:

- `DRAFT` - Report created but not submitted
- `SUBMITTED` - Report submitted by a user
- `LOCKED` - Report locked and cannot be modified

---

## Error Handling

### Bad Request (400)
```json
{
  "message": "Cannot submit: A report for this date has already been locked.",
  "error": "Bad Request",
  "statusCode": 400
}
```

### Not Found (404)
```json
{
  "message": "Daily report with ID 999 not found.",
  "error": "Not Found",
  "statusCode": 404
}
```

### Validation Error (400)
```json
{
  "message": [
    "reportDate must be a valid ISO 8601 date string",
    "submitterId must be a number"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

---

## Important Notes

1. **Date Uniqueness**: Only one daily report can exist per date
2. **Locked Reports**: Once a report is locked, it cannot be modified
3. **Offline-First**: The mobile app can accumulate data offline and submit everything at once daily
4. **Cascading Deletes**: If a DailyReport is deleted, all related Sales and FeedReceipts are automatically deleted (via CASCADE)
5. **Decimal Precision**: Quantities use decimal type with precision of 12 digits and scale of 2 (max: 9999999999.99)

---

## Code Files Created

**Controllers:**
- `src/daily-reports/daily-report.controller.ts` - Handles HTTP requests

**Services:**
- `src/daily-reports/daily-report.service.ts` - Orchestrates daily report submission
- `src/sales/sale.service.ts` - Manages sales and sale items
- `src/feed-receipts/feed-receipt.service.ts` - Manages feed receipts
- `src/shed-daily-reports/shed-daily-report.service.ts` - Manages shed daily reports

**Modules:**
- `src/daily-reports/daily-report.module.ts`
- `src/sales/sale.module.ts`
- `src/feed-receipts/feed-receipt.module.ts`
- `src/shed-daily-reports/shed-daily-report.module.ts`

**DTOs:**
- `src/daily-reports/dto/submit-daily-report.dto.ts` - Main submission DTO
- `src/sales/dto/create-sale.dto.ts` - Sale DTO
- `src/sales/dto/create-sale-item.dto.ts` - Sale Item DTO
- `src/feed-receipts/dto/create-feed-receipt.dto.ts` - Feed Receipt DTO
- `src/shed-daily-reports/dto/create-shed-daily-report.dto.ts` - Shed Daily Report DTO

---

## Usage Tips for Mobile Apps

1. **Build Locally**: Accumulate all data on the device in a local database
2. **Validate Before Submission**: Ensure all required fields are present
3. **Handle Network Errors**: Implement retry logic with exponential backoff
4. **Sync Daily**: Submit once per day at a fixed time
5. **Verify Response**: Check status code 201 for successful submission
6. **Save Submission ID**: Store the returned daily report ID for future reference
