# Lodha Twilio Sheets Caller

This project uses Google Sheets (via Apps Script WebApp) as the data store for a Twilio auto-caller backend.

## Setup

1. Copy `.env.example` -> `.env` and fill values (SHEET_WEBAPP_URL, BASE_URL, etc).
2. Install deps:
   ```
   npm install
   ```
3. Start server:
   ```
   npm start
   ```

## Google Apps Script

Deploy an Apps Script WebApp with endpoints:
- ?action=getNextCustomer
- ?action=getById&id=...
- ?action=updateLead
- ?action=listLeads

See earlier conversation for full Apps Script code.
