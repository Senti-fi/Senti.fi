# 🚀 Senti Backend API

> **Comprehensive Backend Services for Senti** — A Finance 3.0 MVP enabling self-custodial Solana vaults with multi-provider authentication, yield farming, token swapping, and seamless fiat on/off-ramp integration.

## 📋 Table of Contents
1. [Project Overview](#-project-overview)
2. [Architecture & Features](#-architecture--features)
3. [API Documentation](#-api-documentation)
4. [Database Schema](#-database-schema)
5. [Authentication & Security](#-authentication--security)
6. [Testing Guide](#-testing-guide)
7. [Environment Setup](#-environment-setup)
8. [Deployment](#-deployment)
9. [Tech Stack](#-tech-stack)
10. [Contributing](#-contributing)
11. [License](#-license)

---

## 🎯 Project Overview

**Senti Backend** is a robust Node.js/TypeScript API server that powers the Senti ecosystem, providing:

- 🔐 **Multi-Provider Authentication** (Google, Apple, Wallet-based)
- 🏦 **Yield Vault Management** with automatic reward calculations
- 💱 **Token Swapping** via Jupiter Protocol integration
- 💰 **Fiat On/Off-Ramp** services
- 📊 **Transaction Monitoring** and analytics
- 🔒 **Self-Custodial Architecture** (private keys never leave client)

### Key Principles
- **Self-Custodial**: All private keys remain client-side
- **Non-Custodial**: Backend never handles user funds directly
- **Secure**: JWT-based authentication with rate limiting
- **Scalable**: PostgreSQL with Prisma ORM
- **Blockchain-Native**: Built for Solana ecosystem

---

## 🏗️ Architecture & Features

### Core Modules

| Module | Responsibility | Key Features |
|--------|----------------|--------------|
| **Auth** | Multi-provider authentication | Google/Apple OAuth, JWT tokens, wallet-based auth |
| **Vault** | Yield farming management | Deposit/withdraw, reward calculation, lock periods |
| **Swap** | Token exchange | Jupiter Protocol integration, best route selection |
| **Ramp** | Fiat conversion | On/off-ramp via provider APIs, webhook handling |
| **Wallet** | Transaction management | Send/receive, monitoring, QR code support |
| **Monitor** | Analytics & tracking | Transaction history, vault performance, user stats |

### System Flow

#### 1. User Authentication
```mermaid
graph LR
    A[User] --> B[OAuth Provider]
    B --> C[Backend Validation]
    C --> D[JWT Token]
    D --> E[Client Wallet Generation]
    E --> F[Public Key Storage]
```

#### 2. Vault Deposit Flow
```mermaid
graph LR
    A[Client Transaction] --> B[Backend Validation]
    B --> C[Vault Creation/Update]
    C --> D[Reward Calculation]
    D --> E[Database Logging]
```

#### 3. Token Swap Flow
```mermaid
graph LR
    A[Swap Request] --> B[Jupiter Quote]
    B --> C[Best Route Selection]
    C --> D[Transaction Instructions]
    D --> E[Client Signing]
```

---

## 📚 API Documentation

### 🔐 Authentication Endpoints

#### POST `/auth/signup`
Register a new user with wallet, Google, or Apple authentication.

**Request Body:**
```json
{
  "provider": "wallet" | "google" | "apple",
  "token": "string (optional for wallet)",
  "solanaPubkey": "string (required)"
}
```

**Response:**
```json
{
  "token": "jwt_token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "provider": "google",
    "solanaPubkey": "wallet_address",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "token": "google_id_token_here",
    "solanaPubkey": "68az...N23jn"
  }'
```

#### POST `/auth/login`
Authenticate existing user.

**Request Body:** Same as signup

**Response:** Same as signup

---

### 🏦 Vault Management Endpoints

#### POST `/api/vault/deposit`
Deposit tokens into a yield vault.

**Headers:** `Authorization: Bearer <jwt>`

**Request Body:**
```json
{
  "token": "USDC" | "USDT" | "SOL",
  "amount": 100.50,
  "lockedUntil": "2025-06-01T00:00:00Z",
  "vaultName": "My USDC Vault",
  "txHash": "transaction_hash_from_blockchain"
}
```

**Response:**
```json
{
  "userVault": {
    "id": "uuid",
    "amount": 100.50,
    "lockedUntil": "2025-06-01T00:00:00Z",
    "token": "USDC"
  },
  "vaultPubkey": "vault_address",
  "yieldRate": 0.10
}
```

**Yield Rates:**
- **Short-term (90-179 days):** 5% APY
- **Long-term (180+ days):** 10% APY

#### POST `/api/vault/withdraw/instructions`
Get withdrawal instructions for a vault position.

**Request Body:**
```json
{
  "userVaultId": "uuid",
  "allowEarlyWithdrawal": false
}
```

**Response:**
```json
{
  "instructions": [
    {
      "programId": "program_address",
      "keys": [...],
      "data": "base64_encoded_data"
    }
  ],
  "principal": 100.50,
  "rewards": 5.25,
  "withdrawalFee": 0,
  "totalAmount": 105.75
}
```

#### POST `/api/vault/withdraw`
Complete withdrawal after transaction is confirmed.

**Request Body:**
```json
{
  "userVaultId": "uuid",
  "principal": 100.50,
  "rewards": 5.25,
  "withdrawalFee": 0,
  "txHash": "transaction_hash"
}
```

#### GET `/api/vault/user/:userId`
Get all vaults for a user.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "My USDC Vault",
    "token": "USDC",
    "totalDeposits": 1000.00,
    "yieldRate": 0.10,
    "locked": true,
    "lockPeriodDays": 180
  }
]
```

#### GET `/api/vault/:vaultPubkey`
Get detailed vault information.

#### GET `/api/vault/transactions/:vaultPubkey`
Get transaction history for a vault.

#### GET `/api/vault/rewards/:vaultPubkey`
Get reward history for a vault.

---

### 💱 Token Swap Endpoints

#### POST `/api/swap/tokens`
Initiate a token swap via Jupiter Protocol.

**Request Body:**
```json
{
  "fromToken": "USDC",
  "toToken": "SOL",
  "amount": 100.00,
  "userPubkey": "wallet_address"
}
```

**Response:**
```json
{
  "message": "Swap ready",
  "pendingTx": {
    "id": "uuid",
    "status": "pending"
  },
  "quote": {
    "outAmount": "5000000000",
    "priceImpactPct": "0.1"
  },
  "swapInstructions": {
    "swapTransaction": "base64_encoded_transaction"
  }
}
```

#### POST `/api/swap/webhook`
Webhook endpoint for swap status updates (internal use).

---

### 💰 Fiat On/Off-Ramp Endpoints

#### POST `/api/ramp/onramp`
Convert fiat currency to crypto.

**Request Body:**
```json
{
  "amount": 100.00,
  "currency": "USDC",
  "walletAddress": "optional_override"
}
```

**Response:**
```json
{
  "message": "On-ramp initiated successfully",
  "providerData": {
    "paymentUrl": "https://provider.com/pay/...",
    "orderId": "provider_order_id"
  },
  "pendingTx": {
    "id": "uuid",
    "status": "pending"
  }
}
```

#### POST `/api/ramp/offramp`
Convert crypto to fiat currency.

**Request Body:**
```json
{
  "amount": 100.00,
  "currency": "USDC",
  "destination": "bank_account_details"
}
```

**Response:**
```json
{
  "message": "Off-ramp initiated",
  "providerData": {
    "depositAddress": "crypto_address_to_send_to",
    "expiresAt": "2025-01-01T00:00:00Z"
  },
  "pendingTx": {
    "id": "uuid",
    "status": "pending"
  }
}
```

#### POST `/api/ramp/webhook/provider`
Webhook for provider status updates (internal use).

---

### 💳 Wallet Management Endpoints

#### POST `/api/wallet/send`
Send tokens to another wallet.

**Request Body:**
```json
{
  "token": "USDC",
  "amount": 50.00,
  "recipient": "recipient_wallet_address"
}
```

#### POST `/api/wallet/receive`
Generate receive address and QR code.

#### POST `/api/wallet/monitor`
Monitor transaction status.

#### POST `/api/wallet/send-qr`
Send tokens using QR code scanning.

---

## 🗄️ Database Schema

### Core Models

#### User Model
```sql
model User {
  id             String         @id @default(uuid()) @db.Uuid
  email          String?         @unique
  provider       String
  solanaPubkey   String         @unique
  createdAt      DateTime       @default(now())
  lastSeen       DateTime       @updatedAt
  userVaults     UserVault[]
  vaults         Vault[]        @relation("UserVaults")
  transactions   Transaction[]  @relation("UserTransactions")
}
```

#### Vault Model
```sql
model Vault {
  id             String         @id @default(uuid()) @db.Uuid
  userId         String         @db.Uuid
  name           String
  vaultPubkey    String         @unique
  token          String
  yieldRate      Float
  locked         Boolean
  lockPeriodDays Int?
  totalDeposits  Float          @default(0)
  createdAt      DateTime       @default(now())
  user           User           @relation("UserVaults", fields: [userId], references: [id])
  userVaults     UserVault[]
  transactions   Transaction[]  @relation("VaultTransactions")
  rewards        Reward[]
}
```

#### Transaction Model
```sql
model Transaction {
  id            String    @id @default(uuid()) @db.Uuid
  txHash        String    @unique
  userVaultId   String?   @db.Uuid
  vaultId       String?   @db.Uuid        
  vaultPubkey   String?
  userId        String    @db.Uuid
  walletAddress String?
  token         String
  amount        Float
  type          String          
  recipient     String?
  status        String?         
  provider      String?         
  timestamp     DateTime
  userVault     UserVault?      @relation(fields: [userVaultId], references: [id])
  user          User            @relation("UserTransactions", fields: [userId], references: [id])
  vault         Vault?          @relation("VaultTransactions", fields: [vaultId], references: [id])
}
```

---

## 🔐 Authentication & Security

### JWT Token Structure
```json
{
  "userId": "user_uuid",
  "solanaPubkey": "wallet_address",
  "iat": 1640995200,
  "exp": 1641600000
}
```

### Rate Limiting
- **Window:** 15 minutes
- **Max Requests:** 100 per window
- **Headers:** `X-RateLimit-*`

### Security Features
- ✅ Input sanitization with `sanitize-html`
- ✅ JWT token validation
- ✅ Rate limiting
- ✅ CORS protection
- ✅ Environment variable validation
- ✅ Error handling without sensitive data exposure

---

## 🧪 Testing Guide

### Prerequisites
1. **Node.js** (v18+)
2. **PostgreSQL** database
3. **Solana CLI** tools
4. **Environment variables** configured

### Manual API Testing

#### 1. Authentication Flow
```bash
# Test Google Signup
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "token": "your_google_id_token",
    "solanaPubkey": "your_solana_wallet_address"
  }'

# Test Wallet Login
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "wallet",
    "solanaPubkey": "your_solana_wallet_address"
  }'
```

#### 2. Vault Operations
```bash
# Set JWT token from previous auth response
export JWT_TOKEN="your_jwt_token_here"

# Test Vault Deposit
curl -X POST http://localhost:5000/api/vault/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "token": "USDC",
    "amount": 100.00,
    "lockedUntil": "2025-06-01T00:00:00Z",
    "vaultName": "Test Vault",
    "txHash": "test_transaction_hash"
  }'

# Test Withdrawal Instructions
curl -X POST http://localhost:5000/api/vault/withdraw/instructions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "userVaultId": "your_user_vault_id",
    "allowEarlyWithdrawal": false
  }'
```

#### 3. Token Swap Testing
```bash
# Test Token Swap
curl -X POST http://localhost:5000/api/swap/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "fromToken": "USDC",
    "toToken": "SOL",
    "amount": 50.00,
    "userPubkey": "your_wallet_address"
  }'
```

#### 4. Fiat Ramp Testing
```bash
# Test On-Ramp
curl -X POST http://localhost:5000/api/ramp/onramp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "amount": 100.00,
    "currency": "USDC"
  }'

# Test Off-Ramp
curl -X POST http://localhost:5000/api/ramp/offramp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "amount": 50.00,
    "currency": "USDC",
    "destination": "bank_account_info"
  }'
```

### Automated Testing
```bash
# Run tests (if test suite is implemented)
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test:auth
npm run test:vault
npm run test:swap
```

### Test Data Setup
```bash
# Create test user
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "wallet",
    "solanaPubkey": "test_wallet_address_here"
  }'

# Note: Use the returned JWT token for subsequent requests
```

---

## ⚙️ Environment Setup

### Required Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/senti_db"

# JWT Configuration
JWT_SECRET="your_super_secret_jwt_key_here"

# Solana Configuration
SOLANA_RPC="https://api.devnet.solana.com"
# For production: "https://api.mainnet-beta.solana.com"

# Master Wallet Addresses
USDC_MASTER_WALLET_PUBKEY="your_usdc_master_wallet"
USDT_MASTER_WALLET_PUBKEY="your_usdt_master_wallet"
SOL_MASTER_WALLET_PUBKEY="your_sol_master_wallet"

# OAuth Configuration
GOOGLE_CLIENT_ID="your_google_client_id"
APPLE_CLIENT_ID="your_apple_client_id"

# Provider APIs
PROVIDER_API_KEY="your_provider_api_key"
PROVIDER_API_URL="https://provider-api-url.com"

# Server Configuration
PORT=5000
NODE_ENV="development"
BACKEND_URL="http://localhost:5000"
```

### Database Setup

#### 1. Install PostgreSQL
```bash
# macOS
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

#### 2. Create Database
```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE senti_db;

-- Create user (optional)
CREATE USER senti_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE senti_db TO senti_user;
```

#### 3. Run Migrations
```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed database (if seed script exists)
npm run prisma:seed
```

### Solana Setup

#### 1. Install Solana CLI
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"

# Add to PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify installation
solana --version
```

#### 2. Configure Solana
```bash
# Set to devnet for testing
solana config set --url https://api.devnet.solana.com

# Create keypair for testing
solana-keygen new --outfile ~/.config/solana/test-keypair.json

# Get wallet address
solana address
```

---

## 🚀 Deployment

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on http://localhost:5000
```

### Production Build
```bash
# Build TypeScript
npm run build

# Start production server
npm start

# Or use PM2 for process management
pm2 start dist/server.js --name "senti-backend"
```

### Docker Deployment
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

EXPOSE 5000

CMD ["npm", "start"]
```

```bash
# Build and run Docker container
docker build -t senti-backend .
docker run -p 5000:5000 --env-file .env senti-backend
```

### Environment-Specific Configurations

#### Development
- Use Solana devnet
- Local PostgreSQL database
- Detailed logging enabled
- CORS allows localhost

#### Staging
- Use Solana testnet
- Staging database
- Moderate logging
- CORS allows staging domains

#### Production
- Use Solana mainnet
- Production database with backups
- Minimal logging
- Strict CORS policy
- SSL/TLS enabled

---

## 🛠️ Tech Stack

### Backend Technologies
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT + OAuth2
- **Blockchain:** Solana Web3.js
- **Logging:** Winston
- **Rate Limiting:** express-rate-limit

### External Integrations
- **Token Swaps:** Jupiter Protocol API
- **OAuth Providers:** Google, Apple
- **Fiat Ramp:** Provider APIs (configurable)
- **Blockchain:** Solana Network

### Development Tools
- **Package Manager:** npm
- **Build Tool:** TypeScript Compiler
- **Development Server:** ts-node-dev
- **Code Quality:** ESLint, Prettier
- **Testing:** Jest (planned)

---

## 📊 API Response Codes

| Code | Description | Usage |
|------|-------------|-------|
| `200` | Success | Successful requests |
| `201` | Created | Resource creation |
| `400` | Bad Request | Invalid input data |
| `401` | Unauthorized | Missing/invalid JWT |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource not found |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side errors |

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U postgres -d senti_db

# Reset database
npm run prisma:migrate:reset
```

#### 2. Solana RPC Issues
```bash
# Test Solana connection
solana cluster-version

# Check RPC endpoint
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  https://api.devnet.solana.com
```

#### 3. JWT Token Issues
```bash
# Verify JWT secret is set
echo $JWT_SECRET

# Test token generation
node -e "console.log(require('jsonwebtoken').sign({test: true}, process.env.JWT_SECRET))"
```

#### 4. Rate Limiting
```bash
# Check rate limit headers
curl -I http://localhost:5000/api/vault/user/test

# Reset rate limit (restart server)
npm run dev
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=senti:* npm run dev

# Check logs
tail -f combined.log
```

---

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and test thoroughly
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open Pull Request

### Code Standards
- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public functions
- Write tests for new features
- Update documentation for API changes

### Pull Request Guidelines
- Clear description of changes
- Include test cases
- Update README if needed
- Ensure all tests pass
- Code review required

---

## 📄 License

**Proprietary © 2025 Senti Labs. All rights reserved.**

Unauthorized copying or distribution of this code, via any medium, is strictly prohibited.

---
