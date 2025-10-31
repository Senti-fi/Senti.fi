// types/wallet.ts - Wallet and blockchain types

export interface Wallet {
  id: string;
  userId: string; // Links to IdentityServer user
  address: string;
  network: Network;
  type: WalletType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WalletBalance {
  walletId: string;
  address: string;
  balance: string; // In wei or lamports
  balanceUsd: number;
  currency: string;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  walletId: string;
  hash: string;
  from: string;
  to: string;
  amount: string;
  amountUsd: number;
  currency: string;
  status: TransactionStatus;
  type: TransactionType;
  network: Network;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  timestamp: string;
  createdAt: string;
}

export interface Token {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  network: Network;
  logoUrl?: string;
  priceUsd?: number;
  marketCap?: number;
  totalSupply?: string;
}

export interface Portfolio {
  userId: string;
  totalValueUsd: number;
  totalValueChange24h: number;
  totalValueChangePercent24h: number;
  assets: PortfolioAsset[];
  lastUpdated: string;
}

export interface PortfolioAsset {
  tokenId: string;
  symbol: string;
  name: string;
  balance: string;
  balanceUsd: number;
  change24h: number;
  changePercent24h: number;
  percentage: number;
}

export interface Network {
  id: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
}

export interface WalletConnection {
  walletId: string;
  userId: string;
  address: string;
  network: Network;
  isConnected: boolean;
  connectedAt?: string;
  lastActivity?: string;
}

// Enums
export type WalletType = "software" | "hardware" | "external";
export type TransactionStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "cancelled";
export type TransactionType = "send" | "receive" | "swap" | "stake" | "unstake";
export type NetworkType = "ethereum" | "polygon" | "solana" | "bitcoin";

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Request types
export interface CreateWalletRequest {
  userId: string;
  network: Network;
  type: WalletType;
}

export interface SendTransactionRequest {
  walletId: string;
  to: string;
  amount: string;
  currency: string;
  gasPrice?: string;
  gasLimit?: string;
}

export interface GetTransactionsRequest {
  walletId?: string;
  userId?: string;
  page?: number;
  limit?: number;
  status?: TransactionStatus;
  type?: TransactionType;
  fromDate?: string;
  toDate?: string;
}
