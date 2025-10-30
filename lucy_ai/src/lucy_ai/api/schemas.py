from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Union, Dict, Any

class YieldPool(BaseModel):
    pool_id: str
    protocol_name: str
    asset: Literal["USDC", "USDT", "SOL"]
    current_apy: float
    risk_score: int

class SuggestionFact(BaseModel):
    suggestion_type: Literal[
        "MOVE_TO_BETTER_YIELD",
        "HOLD_CURRENT",
        "DEPOSIT_TO_BEST",
        "CLAIM_REWARDS",
        "NO_SUGGESTION",
        "ERROR"
    ]
    asset: Optional[Literal["USDC", "USDT", "SOL"]] = None
    current_apy: Optional[float] = None
    recommended_pool_id: Optional[str] = None
    protocol_name: Optional[str] = None
    apy: Optional[float] = None
    apy_gain: Optional[float] = None
    reasoning: Optional[str] = None

class SuggestionResponse(BaseModel):
    suggestion_text: str

class ChatMessage(BaseModel):
    message: str

class TokenBalance(BaseModel):
    token_symbol: str
    amount_ui: float
    amount_raw: Optional[str] = None
    token_mint: Optional[str] = None
    value_usd: Optional[float] = None

class WalletBalanceResponse(BaseModel):
    wallet_address: str
    balances: List[TokenBalance]

class DepositActionIntent(BaseModel):
    action_type: Literal["DEPOSIT_VAULT"] = "DEPOSIT_VAULT"
    amount: float
    token: Literal["USDC", "USDT", "SOL"]
    target_vault_id: Optional[str] = None
    target_vault_pubkey: Optional[str] = None

class SwapActionIntent(BaseModel):
    action_type: Literal["SWAP_TOKENS"] = "SWAP_TOKENS"
    from_token: Literal["USDC", "USDT", "SOL"]
    to_token: Literal["USDC", "USDT", "SOL"]
    amount: float

AnyActionIntent = Union[DepositActionIntent, SwapActionIntent]

class ChatResponse(BaseModel):
    response: str
    action_intent: Optional[AnyActionIntent] = Field(None, discriminator="action_type")

    class Config:
        json_schema_extra = {
            "example": {
                "response": "Sure, I can help with that!",
                "action_intent": None
            },
            "example_deposit": {
                 "response": "Okay, I'm setting up a deposit of 100 USDC into the 'Main Yield' vault.",
                 "action_intent": {
                     "action_type": "DEPOSIT_VAULT",
                     "amount": 100.0,
                     "token": "USDC",
                     "target_vault_id": "main-yield-vault"
                 }
            }
        }



