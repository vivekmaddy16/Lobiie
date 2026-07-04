# Lobii

Lobii is a real-time community workspace MVP built with Next.js 16, Clerk, Socket.IO, Zustand, Prisma, SQLite, WebRTC, and Tailwind CSS.

## What is working

- Clerk authentication and protected workspace routes
- Community, room, membership, and message persistence with Prisma
- Real-time chat fanout with Socket.IO
- Browser voice and video rooms with WebRTC signaling
- Role-aware room creation for owners and admins

## Stack

- Next.js 16 App Router
- Clerk
- Socket.IO
- Zustand
- Prisma
- SQLite via `better-sqlite3`
- WebRTC
- Tailwind CSS
- shadcn/ui

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables from `.env.example` into `.env` and add your Clerk keys.

3. Start the app:

```bash
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

## Database

This project currently uses SQLite for local development with `DATABASE_URL="file:./dev.db"`.

Useful commands:

```bash
npm run db:generate
npm run db:push
npm run db:studio
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
"# Lobii" 
