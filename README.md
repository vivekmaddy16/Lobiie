# 💬 Lobiie

Lobii is a real-time community workspace platform built with **Next.js 16 (App Router)**, **Clerk**, **Socket.IO**, **Zustand**, **Prisma**, **MySQL**, **WebRTC**, and **Tailwind CSS**. 

It provides a Discord/Slack-like unified workspace experience with real-time text chat, typing indicators, active presence, optimistic updates, and peer-to-peer browser voice and video huddles via WebRTC mesh connections.

---

## ✨ Features

- **🏠 Multi-Tenant Crews (Communities)**
  - Dynamic crew switching and customizable visual accents (e.g., Amber, Ocean, Fern).
  - Role-aware workspace shell accommodating `OWNER`, `ADMIN`, and `MEMBER` roles.
  - Easy member invitations through unique link invitation codes.

- **💬 Real-Time Unified Chat Client**
  - **Optimistic Message Pipeline**: Messages render instantly in the UI with a pending status. A background fetch persists them to the MySQL database via `/api/messages`. Upon success, the optimistic message is swapped with the DB payload and synchronized via Socket.IO. If saving fails, the draft is restored, and the user is alerted.
  - **Typing Indicators**: Live visual feedback showing who is typing in the current channel and in the sidebar.
  - **⚽ Football Tactic Integration**: Paste/type tactical instructions containing words like `"midfield"` or `"creativity"` to auto-display inline tactical pitch diagrams (`tactic_board_green.png` and `tactic_board_white.png`).
  - **📁 Media & File Sharing**: Upload images, videos, audio, and documents locally using the paperclip button next to the input area. Uploads are stored in `public/uploads` via the `/api/upload` endpoint and rendered dynamically inline in the chat bubble based on their MIME type (supporting inline images, videos, audios, and document download cards).

- **🎙️ WebRTC Mesh Voice & Video Huddles**
  - Instant audio and video room channels (`VOICE` and `VIDEO` kinds).
  - Mesh network peer connection signaling via Socket.IO (`webrtc:offer`, `webrtc:answer`, and `webrtc:ice-candidate`).
  - Interactive Media Stage enabling participants to toggle audio/video inputs individually.

- **🔍 Unified Sidebar Navigation**
  - Navigation tabs separating **Rooms**, **Crews**, and **Teams**.
  - Dynamic filtering of active tab items via a fuzzy search bar.
  - Modern interface featuring Clerk User Profile overlays, dark/light theme toggling, and network connection status badge ("Connected" / "Syncing").

---

## ⚙️ Architecture

Lobii utilizes a unified server setup that binds both the standard Next.js request handler and a Socket.IO WebSockets server to a single Node.js HTTP server.

```
       ┌────────────────────────┐
       │   HTTP Server (3000)   │
       └───────────┬────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌─────────────────┐ ┌─────────────────┐
│ Next.js App     │ │ Socket.IO       │
│ Request Handler │ │ (Real-time &    │
│ (Pages / APIs)  │ │ P2P WebRTC)     │
└─────────────────┘ └─────────────────┘
```

- **Socket Server ([server.cjs](file:///c:/Users/vivek/Desktop/Lobiie/server.cjs))**: Manages in-memory voice/video room participant states, chat message fanout, typing states, and WebRTC SDP/ICE signaling exchanges.
- **Client Sync ([use-lobby-socket.ts](file:///c:/Users/vivek/Desktop/Lobiie/src/hooks/use-lobby-socket.ts))**: Binds connection lifecycle, syncing online participants list, message payloads, and active typing statuses directly with a local Zustand store.
- **State Management ([use-room-store.ts](file:///c:/Users/vivek/Desktop/Lobiie/src/hooks/use-room-store.ts))**: Global client-side store containing media track flags, message logs per channel, typing arrays, and server synchronization markers.

------

## 🛠️ Stack & Technologies

- **Core Framework**: [Next.js 16 (App Router)](https://nextjs.org/) & [React 19](https://react.dev/)
- **Auth**: [Clerk Next.js](https://clerk.com/)
- **Real-time Server**: [Socket.IO](https://socket.io/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **ORM & DB**: [Prisma](https://www.prisma.io/) & [MySQL](https://www.mysql.com/)
- **WebRTC**: Browser native mesh audio/video signaling
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have Node.js installed (LTS version recommended) and a running MySQL database server.

### Local Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` into a new `.env` file and provide your credentials:
   ```bash
   cp .env.example .env
   ```
   Add your respective Clerk API keys:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   CLERK_SECRET_KEY=sk_test_your_key_here
   DATABASE_URL="mysql://root:password@localhost:3306/lobiie"
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Database Migration**:
   Run the following commands to initialize the MySQL database schema and generate the Prisma Client:
   ```bash
   npm run db:push
   ```

4. **Start the Application**:
   Launch the Next.js development server running on the custom Socket.IO port (defaults to `http://localhost:3000`):
   ```bash
   npm run dev
   ```

---

## 📜 Available Scripts

Run these scripts inside the project directory:

- **`npm run dev`**: Starts the development environment running Next.js alongside the Socket.IO instance.
- **`npm run build`**: Generates Prisma assets and builds the production Next.js application bundle.
- **`npm run start`**: Runs the compiled production server.
- **`npm run lint`**: Runs ESLint checks across workspace source files.
- **`npm run db:generate`**: Explicitly regenerates the Prisma Client client files.
- **`npm run db:push`**: Syncs the schema with the MySQL database without creating migrations (perfect for rapid prototyping).
- **`npm run db:migrate`**: Creates a new schema migration.
- **`npm run db:studio`**: Opens a browser window for visual data editing inside the MySQL tables.
