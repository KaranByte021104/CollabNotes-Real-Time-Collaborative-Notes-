# CollabNotes Monorepo

## Project Overview
CollabNotes is a real-time collaborative workspace that allows teams to seamlessly create, share, and edit notes together. By utilizing a NestJS backend and Next.js frontend, changes are instantly synchronized across all active users.

## Tech Stack
- **Frontend**: Next.js (App Router, TypeScript, Tailwind CSS, Shadcn/ui)
- **Backend**: NestJS (TypeScript, ConfigModule, TypeORM)
- **Database**: PostgreSQL (pg driver)
- **Real-Time Communication**: Socket.io (to be implemented in subsequent sprints)

---

## Project Structure
```
collab-notes/
├── backend/        ← NestJS backend application
├── frontend/       ← Next.js frontend application
├── sprints/        ← Sprint description files
├── .gitignore      ← Root-level git exclusions
└── README.md       ← Monorepo documentation
```

---

## Getting Started

### Prerequisites
- **Node.js**: v18 or higher
- **PostgreSQL**: A local PostgreSQL database running on port `5432`

### Setup Instructions

1. **Clone the repository and initialize root dependencies:**
   ```bash
   git clone <repository-url>
   cd collab-notes
   ```

2. **Configure the Backend:**
   Navigate to the backend directory, copy the template env file, and install dependencies:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   ```
   *Note: Edit the `.env` file to match your local PostgreSQL database credentials (user, password, host, port, database name).*

3. **Configure the Frontend:**
   Navigate to the frontend directory, copy the template env file, and install dependencies:
   ```bash
   cd ../frontend
   cp .env.example .env.local
   npm install
   ```

4. **Running the Applications:**
   
   - **Start the NestJS backend (on port 3001):**
     ```bash
     cd backend
     npm run start:dev
     ```
   
   - **Start the Next.js frontend (on port 3000):**
     ```bash
     cd frontend
     npm run dev
     ```

---

## Environment Variables

### Backend Variables (`backend/.env`)

| Variable Name | Description | Default / Example Value |
| :--- | :--- | :--- |
| `PORT` | The port the backend server listens on | `3001` |
| `DATABASE_HOST` | Host address of PostgreSQL server | `localhost` |
| `DATABASE_PORT` | Port number of PostgreSQL server | `5432` |
| `DATABASE_USER` | PostgreSQL login username | `postgres` |
| `DATABASE_PASSWORD` | PostgreSQL login password | `postgres` |
| `DATABASE_NAME` | PostgreSQL database name | `collab_notes` |
| `JWT_SECRET` | Secret token used to sign/verify JWTs | `supersecretjwtsecretkeyshouldbechangedinproduction` |
| `FRONTEND_URL` | The origin URL of the Next.js frontend | `http://localhost:3000` |

### Frontend Variables (`frontend/.env.local`)

| Variable Name | Description | Default / Example Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | The base URL for the backend API endpoints | `http://localhost:3001/api` |
| `NEXT_PUBLIC_SOCKET_URL`| The connection URL for real-time WebSocket events | `http://localhost:3001` |
