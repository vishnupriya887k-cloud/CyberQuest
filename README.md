# CyberQuest Quiz

A complete 15-question technical quiz with:

- 10-minute server-enforced quiz duration
- One attempt per team
- MongoDB database
- Admin login
- Admin results dashboard
- Team name, mark, time taken and status
- CSV export
- Responsive frontend
- Server-side scoring
- Database unique index to prevent duplicate team names

## 1. Requirements

Install Node.js 18+.

Create a MongoDB Atlas cluster and get its connection string.

## 2. Configure environment

Copy `.env.example` to `.env` and edit:

```text
PORT=5000
MONGODB_URI=your-mongodb-atlas-connection-string
JWT_SECRET=use-a-long-random-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secret-admin-password
CLIENT_ORIGIN=http://localhost:5000
```

Never upload `.env` to GitHub.

## 3. Install and run

```bash
npm install
npm start
```

Open:

```text
http://localhost:5000
```

Admin:

```text
http://localhost:5000
```

Click `Admin` and use the username/password from `.env`.

## 4. MongoDB Atlas

In MongoDB Atlas:

1. Create a free cluster.
2. Create a database user.
3. In Network Access, add the IP/network allowed to connect.
4. Copy the Node.js connection string.
5. Put it in `MONGODB_URI`.

The application creates the `teams` collection automatically when the first team starts.

## 5. Important behavior

When a team clicks START QUIZ, the server creates its database record immediately.

The `normalizedTeamName` field has a unique index. This prevents two devices from registering the same team name at the same time.

The browser timer is only for display. The server calculates the real elapsed time using `startedAt`. Therefore changing the browser clock or JavaScript timer does not extend the 10-minute limit.

The correct answers are stored only in `server.js` and are never sent to the browser.

## 6. Deployment

You can deploy the Node/Express project to Render, Railway, or another Node.js host.

Set all `.env` variables as hosting-platform environment variables.

If the same Express server serves the frontend, no separate frontend deployment is required.

## 7. Changing questions

Edit the `questionBank` array in `server.js`.

Each question has:

```js
{
  id: 1,
  question: "Question text",
  options: ["A", "B", "C", "D"],
  answer: 1
}
```

The `answer` is zero-based:

- 0 = A
- 1 = B
- 2 = C
- 3 = D

Keep exactly 15 questions if you want the current dashboard and score display to remain `/15`.

## 8. Production security notes

- Use HTTPS in production.
- Use a strong random JWT_SECRET.
- Use a strong ADMIN_PASSWORD.
- Do not commit `.env`.
- Restrict MongoDB network access appropriately.
- Consider adding rate limiting before a public event.
