# Senti Frontend

> **Finance 3.0 – Money That Just Works**

The frontend application for Senti's AI-powered DeFi vault platform, featuring Lucy, our predictive AI assistant that helps users make stable, automated financial decisions.

## 🎯 Project Overview

Senti is a proof-of-concept MVP demonstrating intelligent DeFi automation through AI-guided yield optimization. This frontend provides users with a clean, intuitive interface to deposit stable assets, receive AI recommendations, and track portfolio growth in real-time.

## ✨ Features

- **Wallet Integration**: Seamless connection via WalletConnect and Web3 adapters
- **Deposit Flow**: Simple USDT/USDC deposits into AI-managed vaults
- **Lucy AI Assistant**: Real-time yield suggestions and portfolio insights
- **Vault Management**: Lock funds with customizable durations and view projected returns
- **Growth Dashboard**: Live portfolio tracking with APY projections and growth metrics
- **AI Insight Feed**: Natural language updates from Lucy about vault activities
- **Transaction History**: Complete record of deposits, locks, and withdrawals

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **Wallet SDK**: Solana Web3.js
- **State Management**: React Context 
- **API Client**: Axios 
- **Version Control**: Git + GitHub

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher
- **yarn**
- **Git**: For version control

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone 
cd senti-frontend
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Backend API
NEXT_PUBLIC_API_URL=

```

### 4. Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3002) in your browser to see the application.



## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

```

## 🌐 Key User Flow

1. **Create Wallet** → User authentication via App Wallet
2. **Deposit Stable Asset** → USDT/USDC deposit with confirmation
3. **Lucy Activates** → AI displays best available yield options
4. **Lock Funds** → User accepts suggestion and locks vault
5. **Dashboard View** → Real-time balance, growth projections, and insights
6. **Withdraw** → Optional withdrawal


Built mobile-first with breakpoints:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🔐 Security Considerations

- Never expose private keys in the frontend
- All sensitive operations go through backend
- Input validation on all forms
- Secure wallet connection flow
- Rate limiting on API calls


## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit your changes: `git commit -m 'Add some feature'`
3. Push to the branch: `git push origin feature/your-feature`
4. Open a Pull Request
