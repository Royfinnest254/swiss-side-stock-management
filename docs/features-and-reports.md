# Features and report generation

## Inventory and stock activity

The interface has department pages for Kitchen, Spa, Shop, Gym, Supplies, and Laundry, plus General Supplies and accommodation features. Inventory records can be grouped in folders. Stock movements are recorded through the department API routes and saved in MySQL. The dashboard provides cross-inventory metrics and search through `/api/dashboard`.

## Shopping lists and the generated reorder draft

The Needs screen has two distinct workflows:

- **Shopping lists** are the manual procurement lists. Staff can create and edit a list and its lines.
- **Reorder draft** is a separate draft that can be synchronized from eligible low-stock inventory. Its generated lines are editable, and staff can add a manual line. Recording an item as purchased marks it and can restock the linked item.

```mermaid
flowchart LR
    Inventory[Active inventory records] --> Check{Stocked and automatic reorder enabled?}
    Check -->|No| Omit[Not considered for generated draft]
    Check -->|Yes| Minimum{Quantity below minimum?}
    Minimum -->|No| Omit
    Minimum -->|Yes| Suggest[Suggest amount to reach restock target]
    Suggest --> Draft[Separate editable reorder draft]
    Draft --> Human[Staff edits, removes, or adds lines]
    Human --> Purchase[Record purchase and restock]
```

Item type and auto-reorder settings are part of inventory configuration. The generated draft only includes items that are active, stocked, explicitly enabled for automatic reorder, and below their configured minimum. The suggested amount aims to bring stock up to the configured restock target. This is a draft for staff review, not an order sent to a supplier.

## What reports generate

```mermaid
sequenceDiagram
    actor User
    participant Page as Reports page
    participant API as /api/reports
    participant DB as MySQL
    participant PDF as PDFKit
    participant Mail as Nodemailer and SMTP
    User->>Page: Select a date range or report action
    Page->>API: Request summary, analytics, movements, or PDF
    API->>DB: Read inventory and recorded activity
    DB-->>API: Rows and totals
    alt Download statement
        API->>PDF: Format activity rows as a PDF
        PDF-->>Page: Downloadable PDF
    else Email report
        API->>PDF: Create summary or detailed PDF as requested
        API->>Mail: Send email through configured SMTP server
        Mail-->>User: Report delivered to chosen address
    else Dashboard report data
        API-->>Page: JSON metrics and movement rows
    end
```

The Reports screen offers time periods, analytics and movement data, a downloadable operations statement, and email delivery of a summary or detailed report. PDF creation uses PDFKit in `backend/src/services/reportPdf.js` and `backend/src/routes/reports.js`; email delivery uses Nodemailer through `backend/src/services/email.js`.

### Coverage detail

The detailed activity query in `backend/src/routes/reports.js` reads transaction tables for Kitchen, Spa, Shop, Gym, Supplies, and Laundry. General Supplies uses a shared `transactions` route/table and is not currently part of that same detailed activity query. Check the individual report endpoint before assuming every report includes every feature area.

The system can only report activity that was recorded in its database. It does not scan receipts or infer purchases from external sources.
