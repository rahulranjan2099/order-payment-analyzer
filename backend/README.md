# Backend

Simple Express + Prisma backend for the order-payment analyzer.

## Run locally

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## Build

```bash
npm run build
```

## Notes

- Update the database URL and JWT secret in `.env`.
- Run the database setup script if needed.

```bash
npm run setup:db
```
