# Northstar Market

A full-stack Flask e-commerce marketplace with SQLite persistence, role-aware customer/seller/admin workspaces, checkout shipping rates, product search, image uploads, and an AI-style customer concierge.

## Run locally

```powershell
cd "Copilot Prompts/Copilot_prompt1"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:MARKETPLACE_ENV = "development"
python app.py
```

Open `http://127.0.0.1:5000`.

Demo accounts are seeded only when running in explicit development mode and initializing an empty database:

- Customer: `customer@example.com` / `customer`
- Seller: `seller@example.com` / `seller`
- Admin: `admin@example.com` / `admin`

The SQLite database is created automatically as `marketplace.db`. Development mode generates a temporary random session secret if `MARKETPLACE_SECRET` is unset, so restarting the app signs out existing sessions.

For production, set a unique, high-entropy `MARKETPLACE_SECRET` and do not set `MARKETPLACE_ENV=development`. The app refuses to start without a secret outside development mode and runs without Flask debug mode. Existing databases are not automatically altered: change or remove any demo credentials already present and rotate the session secret as part of deployment.

Checkout uses a transparent UPS Ground estimate from `110 Inner Campus Drive, Austin, TX 78705`; orders of $75 or more receive free ground shipping.

Every JSON endpoint returns a clear 4xx response for malformed or missing input, requires authentication where appropriate, and checks the current role and resource ownership before mutation.
