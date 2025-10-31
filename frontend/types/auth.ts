// types/auth.ts - IdentityServer compatible types

export interface User {
  sub: string; // Subject identifier (user ID)
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  phone_number_verified?: boolean;
  picture?: string;
  locale?: string;
  updated_at?: number;
  created_at?: number;
}

export interface UserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  phone_number_verified?: boolean;
  picture?: string;
  locale?: string;
  updated_at?: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

export interface LoginRequest {
  username: string;
  password: string;
  grant_type: "password";
  scope?: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
  grant_type: "refresh_token";
}

export interface LogoutRequest {
  id_token_hint?: string;
  post_logout_redirect_uri?: string;
}
