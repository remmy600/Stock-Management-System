# UBUBIKO SMART API

Node.js + Express + MongoDB Atlas backend for the existing UBUBIKO SMART frontend.

## Features

- JWT authentication with hashed passwords
- Role-based authorization: Admin, Manager, Cashier and Storekeeper
- Products and inventory
- Transaction-safe stock IN / OUT operations
- Stock requests and approval
- Suppliers and customers
- Returns and restocking
- User administration and audit history
- Health endpoint for Render

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Create a MongoDB Atlas database and place its connection URI in `MONGODB_URI`.
4. Generate a private JWT secret (at least 32 characters) and place it in `JWT_SECRET`.
5. Install packages and create the first administrator:

```bash
npm install
npm run seed:admin
npm run dev
```

The API runs at `http://localhost:10000` by default. Check `/api/health`.

## Render

This repository includes a root `render.yaml` Blueprint. Create a Blueprint deployment from this repository. Set:

- `MONGODB_URI`: the MongoDB Atlas connection string
- `CLIENT_ORIGIN`: the exact deployed frontend URL (no trailing slash)

Render generates `JWT_SECRET` from the Blueprint. Keep every secret in Render Environment settings, never in Git.

MongoDB Atlas must also allow connections from Render. In Render, open the service, click **Connect → Outbound**, and copy the outbound IP ranges for the service region. In Atlas, go to **Database & Network Access → IP Access List** and add those CIDR ranges. A temporary `0.0.0.0/0` entry can unblock testing, but use a strong database password and restrict the list to Render ranges afterwards.

The API health check is `/api/health`.

## Authentication

Send the token from `POST /api/auth/login` on protected routes:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

Login body:

```json
{
  "username": "your-admin-username",
  "password": "your-admin-password"
}
```

## Main API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | API and database health |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/change-password` | Change own password |
| GET/POST | `/api/products` | List / create products |
| PATCH/DELETE | `/api/products/:id` | Update / delete product |
| GET/POST | `/api/movements` | Stock history / stock IN or OUT |
| GET/POST | `/api/requests` | List / create stock requests |
| PATCH | `/api/requests/:id/status` | Approve, reject or process a request |
| GET/POST | `/api/suppliers` | List / create suppliers |
| PATCH/DELETE | `/api/suppliers/:id` | Update / delete supplier |
| GET/POST | `/api/customers` | List / create customers |
| GET/POST | `/api/returns` | List / register returns |
| PATCH | `/api/returns/:id/status` | Review or restock a return |
| GET/POST | `/api/users` | List / create users (Admin) |
| PATCH | `/api/users/:id/block` | Block / unblock user (Admin) |
| PATCH | `/api/users/:id/password` | Reset a user's password (Admin) |
| GET | `/api/audit` | View audit history |

This API is added on a separate branch. The existing static frontend is not yet switched from browser demo storage to the API. Complete the frontend integration before using this as the live school inventory system.
