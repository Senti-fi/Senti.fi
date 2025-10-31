// Global type definitions

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (
        event: string,
        handler: (...args: any[]) => void
      ) => void;
    };
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: any }>;
      disconnect: () => Promise<void>;
      signTransaction: (transaction: any) => Promise<any>;
      signAllTransactions: (transactions: any[]) => Promise<any[]>;
    };
  }
}

// Environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_IDENTITY_SERVER_URL: string;
    NEXT_PUBLIC_CLIENT_ID: string;
    NEXT_PUBLIC_REDIRECT_URI: string;
    NEXT_PUBLIC_POST_LOGOUT_REDIRECT_URI: string;
    NEXT_PUBLIC_SCOPE: string;
    NEXT_PUBLIC_RESPONSE_TYPE: string;
    NEXT_PUBLIC_RESPONSE_MODE: string;
  }
}

export {};
