# Librarian workflow upgrade

This package is based on the latest AI-Based-Smart-LMS archive available in the conversation and adds a backend return-inspection/fine workflow.

## What is included
- Fixes the borrowing serializer and overdue-record loop.
- Adds a `fines` Django app and read-only fine listing API.
- Sets the default overdue fine to ETB 2 per day (overridable with `FINE_PER_DAY`).
- Student return action now submits a return request; it does not release inventory.
- Librarian API actions: list return requests, inspect a return, verify a fine payment, and finalize the return.
- Book availability is increased only after the librarian finalizes the return.

## API workflow
- `POST /api/borrowing/borrows/{id}/return/` — student requests return.
- `GET /api/borrowing/borrows/return-requests/` — librarian lists requests.
- `POST /api/borrowing/borrows/{id}/inspect-return/` JSON: `{"damage_status":"none|minor|moderate|severe|lost","damage_notes":"...","damage_fine":"0.00"}`
- `POST /api/borrowing/borrows/{id}/verify-payment/` JSON: `{"transaction_reference":"..."}` (librarian records payment verification after confirming it externally).
- `POST /api/borrowing/borrows/{id}/finalize-return/` — librarian completes return after inspection and payment if required.
- `GET /api/fines/` — fines visible to the owner and librarian/admin roles.

## Windows PowerShell setup
From the `backend` directory with the virtual environment active:

```powershell
python manage.py check
python manage.py migrate
python manage.py runserver
```

Back up your MySQL database before migrating. Do not delete existing migrations or database tables.

## Important scope note
This is a backend return/fine workflow upgrade. It does not yet add individual physical-copy barcodes or shelf/section management, and the existing React librarian dashboard needs UI work to expose the new actions. Payment verification here is a librarian-recorded confirmation; it does not itself integrate with Chapa.
