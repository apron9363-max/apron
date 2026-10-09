# 🟡 APRON — Rewards & Tasks Earning Platform

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-gold)
![License](https://img.shields.io/badge/license-MIT-purple)
![Platform](https://img.shields.io/badge/platform-Web-ff3cbe)
![Stack](https://img.shields.io/badge/stack-Next.js%20%2B%20Firebase-blue)

**Earn coins by completing tasks, quizzes & referrals — withdraw straight to your bank.**

[Live Demo](#) • [Report Bug](#) • [Request Feature](#)

</div>

---

## 📖 About

**Apron** is a gamified rewards platform where users earn **APN coins** through daily tasks, quizzes, social engagement and referrals. Coins accrue hourly based on the user's membership plan and can be withdrawn to a bank account after admin approval. Includes a full **admin panel** for managing users, payouts and plans.

Built mobile-first with a premium dark-purple fintech aesthetic.

## ✨ Features

### 👤 User Side

- 🔐 **Authentication** — Register, OTP verification, login/logout, protected routes
- 🏠 **Dashboard** — Real-time hourly APN accrual, balance overview, referral link with copy-to-clipboard
- ✦ **Tasks & Quiz** — Complete tasks to earn instant rewards; daily quiz with jackpot
- ◷ **Earning History** — Timestamped feed of all earnings
- ▣ **Wallet & Withdrawals** — Amount quick-chips, transparent fee summary, receipt with transaction ID
- ◈ **Membership Plans** — Starter (free), Pro, Elite — higher hourly rates for paid plans
- ♪ **Social Monetization** — Paid video-promotion & share-to-earn programs

### 🛡 Admin Panel

- 📊 **Overview** — Total users, pending payouts, total paid out, recent signups
- 👥 **User Management** — Search users, edit balances, ban/unban accounts
- 💸 **Withdrawal Queue** — Approve & pay, or reject with **automatic fund refund**
- ◈ **Plan Management** — Edit plan prices and hourly rates

## 🚀 Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend / DB | Firebase Auth, Cloud Firestore, Security Rules |
| State & Forms | React hooks, react-hook-form + Zod |
| Payments (planned) | Paystack / Flutterwave |

## 🎮 Quick Start (Demo)

This repo includes a **zero-install demo** (`apron_platform_demo.html`) — a fully interactive prototype with a simulated database (localStorage). Open it in any browser:

```bash
# just open the file
open apron_platform_demo.html
```

| Role | Email | Password |
| --- | --- | --- |
| 👤 Demo User | `user@apron.app` | `user123` |
| 🛡 Admin | `admin@apron.app` | `admin123` |

> ⚠️ Demo data resets if you clear browser storage.

## 🛠️ Running the Full App

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/apron.git && cd apron

# 2. Install dependencies
npm install

# 3. Configure Firebase
cp .env.example .env.local
# Fill in your Firebase config keys (console.firebase.google.com)

# 4. Run
npm run dev
```

App runs at `http://localhost:3000`

## 🗂️ Project Structure

```javascript
apron/
├── app/
│   ├── (auth)/login, register, otp
│   ├── (app)/dashboard, tasks, history, wallet, plans
│   ├── admin/           # role-protected admin panel
│   └── api/             # server actions & API routes
├── components/          # Button, Card, Input, Modal, StatCard...
├── lib/firebase/        # client + admin SDK setup
├── types/               # TypeScript models
├── firestore.rules      # security rules
└── seed/                # plans & demo data seed script
```

## 🔥 Firestore Collections

`users` • `tasks` • `submissions` • `withdrawals` • `plans` • `earnings`

## 🗺️ Roadmap

- [ ] Paystack/Flutterwave plan payments
- [ ] Contests & leaderboards
- [ ] Loans module
- [ ] Push notifications
- [ ] PWA / mobile app wrapper

## ⚠️ Disclaimer

Apron is a rewards platform — user payouts are funded by **real revenue** (subscriptions, brand tasks, ads), not new user deposits. Referral rewards are single-level by design.

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

---

<div align="center">
Built with 💜 by the Apron team — <i>earn • learn • grow</i>
</div>
