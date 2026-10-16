# TeaCollector

TeaCollector is an authenticated tea collection workflow for estate owners, collection companies, and collectors. It supports lorry management, collection requests, weight entry, bills, and payment status.

## Run the backend

1. In `backend`, copy `.env.example` to `.env` and enter your MongoDB Atlas connection string as `MONGO_URI`.
2. Run `npm install`.
3. Run `npm run dev`.

The API runs at `http://localhost:5000` and uses the workflow API only.

## Run the frontend

1. In `frontend`, run `npm install`.
2. Run `npm run dev`.
3. Open the URL printed by Vite, usually `http://localhost:5173`.

The Vite development server forwards `/api` requests to the backend. Register an estate owner account and a collection company account. A company can set its rate, create collector accounts, and register lorries. An owner selects a lorry when making a collection request. The assigned collector records the actual weight; the company can pay individual bills or group a Tea Seller's unpaid completed collections into one monthly settlement.

## Data

The workflow stores users, companies, lorries, and requests in MongoDB collections named `users`, `companies`, `lorries`, and `requests`.

Do not share or commit your `.env` file. The project ZIP excludes it; use `.env.example` to make a private local copy.
