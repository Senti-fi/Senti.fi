import logging
import asyncio
from fastapi import APIRouter, HTTPException, status, Path, Depends, Query
from typing import Literal, List, Optional, Dict, Any 
from fastapi.security import OAuth2PasswordBearer
from ..core.engine import find_best_yield_suggestion
from ..core.personality import generate_nlp_suggestion
from .schemas import SuggestionResponse, SuggestionFact
from ..core.personality import generate_chat_response
from ..services.senti_backend import get_user_vaults, UserVaultData
from ..services.solana_rpc import get_wallet_balances
from .schemas import (YieldPool, TokenBalance, WalletBalanceResponse, AnyActionIntent, ChatResponse, ChatMessage, SuggestionResponse, SuggestionFact)
from jose import JWTError, jwt


router = APIRouter()
logger = logging.getLogger(__name__)

SUPPORTED_ASSETS = Literal["USDC", "USDT", "SOL"]
SECRET_KEY = "77e3695147568c243a59d5ccbdd91a8954817c2daf36279afd9e1c86cd4150f1" #JWT_SECRET (would add it in .env its only for now)
ALGORITHM = "HS256"

SUPPORTED_ASSETS = Literal["USDC", "USDT", "SOL"]
oauth2_schema = OAuth2PasswordBearer(tokenUrl = "token", auto_error = False)
credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)
async def get_raw_token(token: str = Depends(oauth2_schema)) -> str: 
    if not token:
        logger.warning("No authentication token provided in request.")
        raise credentials_exception #<-- Used new exception
    logger.debug(f"Received auth token (first 10 chars): {token[:10]}...")
    return token

async def get_current_payload(token: str = Depends(get_raw_token)) -> Dict[str, Any]:
    """
    Decodes and validates the JWT, returning its payload.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"JWT decoding failed: {e}")
        raise credentials_exception

async def get_user_public_key(payload: Dict[str, Any] = Depends(get_current_payload)) -> str:
    """Dependency to extract Solana public key from validated JWT."""
    pubkey: Optional[str] = payload.get("solanaPubkey")
    
    if pubkey is None:
        logger.error("JWT payload is missing 'solanaPubkey' field.")
        raise credentials_exception
        
    logger.debug(f"Extracted solanaPubkey: {pubkey}")
    return pubkey
  

###############################################################################################

@router.get(
    "/suggestions/{user_id}",
    response_model = SuggestionResponse,
    summary = "Get AI Yield",
    description = "Welcome to LUCY",
    tags = ["Suggestions"]
)

async def get_suggestion_for_user(
    user_id: str = Path(..., description = "The unique identifier for the User"),
    asset: SUPPORTED_ASSETS = Query(..., description="The stablecoin/asset (USDC, USDT, SOL) to get suggestions for"), 
    auth_token: str = Depends(get_raw_token),
    payload: Dict[str, Any] = Depends(get_current_payload)
):
    logger.info(f"received suggestions request for user id : {user_id}, asset : {asset}")
    user_asset = asset
    
    try:
        user_vaults: List[UserVaultData] = await get_user_vaults(user_id=user_id, auth_token=auth_token)
        logger.info(f"Successfully fetched {len(user_vaults)} vaults for user {user_id} from backend for suggestion.")
    except HTTPException as http_exc:
        logger.error(f"HTTP Error fetching vaults for suggestion user {user_id}: Status {http_exc.status_code} - {http_exc.detail}")
        raise http_exc 
    except Exception as e:
        logger.error(f"Unexpected error fetching vaults for suggestion user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve user vault data.") from e

    try:
        # TODO: Engine needs access to live pool data from solana_rpc as well
        live_pools = [] # Call RPC service
        suggestion_fact: Optional[SuggestionFact] = find_best_yield_suggestion(target_asset=asset, user_vaults=user_vaults, available_pools= live_pools)
        if suggestion_fact is None:
            logger.error(f"Core engine returned None for suggestion user {user_id}, asset {asset}.")
            raise HTTPException(status_code=500, detail="Could not determine a valid suggestion.")
        logger.info(f"Core engine produced fact: {suggestion_fact.model_dump()}")

    except Exception as e:
        logger.error(f"error running core engine for user {user_id}, asset {asset}: {e}", exc_info = True)
        raise HTTPException(
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail = "Failed to analyze yield options..."
            ) from e

    try:
        nlp_suggestion_text = await generate_nlp_suggestion(suggestion_fact)
        logger.info(f"NLP layer generated suggestions: {nlp_suggestion_text}")
    except Exception as e:
        logger.error(f"Error generating NLP suggestions for user {user_id}: {e}", exc_info = True)
        raise HTTPException(
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail = "Failed to generate suggestion text"
        ) from e


    return SuggestionResponse (suggestion_text = nlp_suggestion_text)


@router.post(
    "/chat/{user_id}",
    response_model=ChatResponse,
    summary="Chat with Lucy AI",
    description="Send a message to Lucy and get a conversational response.",
    tags=["Chat"]
)
async def chat_with_lucy(
    chat_message: ChatMessage,
    user_id: str = Path(..., description="The unique identifier for the User"),
    auth_token: str = Depends(get_raw_token), 
    user_pubkey: str = Depends(get_user_public_key),
):
    """
    Handles conversational interactions with the Lucy AI.
    """
    logger.info(f"Received chat message from user_id: {user_id}: '{chat_message.message}'")



    user_context_str: str = "Could not retrieve user context."
    try:
        logger.debug(f"Fetching context for user {user_id}, pubkey {user_pubkey}")
        user_vaults_task = get_user_vaults(user_id=user_id, auth_token=auth_token)
        wallet_balances_task = get_wallet_balances(wallet_address=user_pubkey) 

        user_vaults, wallet_balances = await asyncio.gather(
            user_vaults_task,
            wallet_balances_task,
            return_exceptions=True 
        )
        
        context_parts = []

        if isinstance(user_vaults, HTTPException):
             logger.warning(f"Failed to fetch user vaults (HTTP {user_vaults.status_code}): {user_vaults.detail}")
             context_parts.append(f"Error retrieving vault details ({user_vaults.status_code}).")
        elif isinstance(user_vaults, Exception):
             logger.warning(f"Failed to fetch user vaults for chat context: {user_vaults}")
             context_parts.append("Error retrieving vault details.")
        elif user_vaults:
             vault_summaries = []
             for vault in user_vaults:
                 status = "Locked" if vault.locked else "Unlocked"
                 apy_percent = vault.yieldRate * 100
                 lock_info = f" ({vault.lockPeriodDays} days)" if vault.lockPeriodDays else ""
                 vault_summaries.append(
                     f"- Vault '{vault.name}': {vault.totalDeposits:.2f} {vault.token}, APY: {apy_percent:.2f}%, Status: {status}{lock_info}"
                 )
             context_parts.append("User's Vaults:\n" + "\n".join(vault_summaries))
        else:
             context_parts.append("User has no Senti vaults.")


        if isinstance(wallet_balances, HTTPException):
            logger.warning(f"Failed to fetch wallet balances (HTTP {wallet_balances.status_code}): {wallet_balances.detail}")
            context_parts.append(f"Error retrieving wallet balances ({wallet_balances.status_code}).")
        elif isinstance(wallet_balances, Exception):
            logger.warning(f"Failed to fetch wallet balances for chat context: {wallet_balances}")
            context_parts.append("Error retrieving wallet balances.")
        elif wallet_balances and wallet_balances.balances: # Check if list is not empty
            balance_summaries = [f"- Wallet: {bal.amount_ui:.4f} {bal.token_symbol}" for bal in wallet_balances.balances]
            context_parts.append("User's Wallet Balances:\n" + "\n".join(balance_summaries))
        else: # Handles None response or empty balances list
             context_parts.append("Could not find wallet balances or wallet is empty.")

        user_context_str = "\n".join(context_parts)
        logger.debug(f"Providing context to LLM:\n{user_context_str}")

    except Exception as e:
        logger.error(f"Unexpected error fetching context for chat user {user_id}: {e}", exc_info=True)
        user_context_str = "An unexpected error occurred while retrieving account details."


    try:

        ai_result_dict = await generate_chat_response(
            user_message=chat_message.message,
            user_context=user_context_str
        )
        ai_response_text: str = ai_result_dict.get("text")
        action_intent_result: Optional[AnyActionIntent] = ai_result_dict.get("action_intent")

        if not ai_response_text:
            raise HTTPException(status_code=500, detail="AI failed to generate a response.")

        logger.info(f"LLM Chat Response Text: {ai_response_text}")

        if action_intent_result:
            logger.info(f"Detected Action Intent: {action_intent_result.model_dump()}")
    
    except HTTPException as http_exc:
         raise http_exc
    except Exception as e:
        logger.error(f"Error generating chat response for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get response from AI."
        )
    return ChatResponse(response=ai_response_text, action_intent=action_intent_result)



@router.get(
    "/balances",
    response_model=WalletBalanceResponse,
    summary="Get User Wallet Balances",
    description="Fetches the current token balances (SOL, USDC, USDT) directly from the user's wallet address on the Solana blockchain. Requires authentication.",
    tags=["Wallet"]
)
async def get_user_wallet_balances_endpoint( 
    user_pubkey: str = Depends(get_user_public_key) 
):
    """Endpoint to retrieve user's on-chain wallet balances."""
    logger.info(f"Received balance request for wallet: {user_pubkey}")
    try:
        # Call the service function to get balances
        balances = await get_wallet_balances(wallet_address=user_pubkey)
        if balances is None:
             # Handle cases where the service function might return None (e.g., invalid address)
             raise HTTPException(status_code=404, detail="Could not retrieve balances for the wallet address.")
        return balances
    except HTTPException as http_exc:
        # Re-raise known HTTP exceptions from the service layer
        raise http_exc
    except Exception as e:
        # Catch unexpected errors
        logger.error(f"Error fetching wallet balance for {user_pubkey}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve wallet balances.")
# --- END OF ADDED BLOCK --