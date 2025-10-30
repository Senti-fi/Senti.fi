from typing import List, Optional, Literal, Dict, Any
import logging
from ..api.schemas import SuggestionFact, YieldPool
from ..services.senti_backend import UserVaultData

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from ..main import settings
    MAX_MVP_RISK_SCORE = settings.MAX_MVP_RISK_SCORE
except ImportError:
    logger.warning("Could not import settings from main. Using fallback MAX_MVP_RISK_SCORE.")
    MAX_MVP_RISK_SCORE = 3



AVAILABLE_POOLS_MVP: List[YieldPool] = [
    YieldPool(pool_id="aave_usdc_v3_eth", protocol_name="Aave V3 (Ethereum)", asset="USDC", current_apy=5.8, risk_score=2),
    YieldPool(pool_id="compound_usdc_eth", protocol_name="Compound (Ethereum)", asset="USDC", current_apy=5.5, risk_score=2),
    YieldPool(pool_id="solend_usdc_sol", protocol_name="Solend (Solana)", asset="USDC", current_apy=6.2, risk_score=3),
    YieldPool(pool_id="new_usdc_arb", protocol_name="NewDeFi (Arbitrum)", asset="USDC", current_apy=7.5, risk_score=4), # Higher risk
    YieldPool(pool_id="aave_usdt_v3_eth", protocol_name="Aave V3 (Ethereum)", asset="USDT", current_apy=6.1, risk_score=2),
    YieldPool(pool_id="compound_usdt_eth", protocol_name="Compound (Ethereum)", asset="USDT", current_apy=5.9, risk_score=2),
    YieldPool(pool_id="solend_usdt_sol", protocol_name="Solend (Solana)", asset="USDT", current_apy=6.5, risk_score=3),
    YieldPool(pool_id="marinade_sol_sol", protocol_name="Marinade Staking", asset="SOL", current_apy=7.0, risk_score=2),
    YieldPool(pool_id="lido_sol_sol", protocol_name="Lido Staking", asset="SOL", current_apy=6.8, risk_score=2),
]

def find_best_yield_suggestion(
    target_asset: Literal["USDT", "USDC", "SOL"],
    user_vaults: List[UserVaultData],
    available_pools: List[YieldPool] = AVAILABLE_POOLS_MVP
) -> SuggestionFact:

    logger.info(f"Engine: Finding suggestion for {target_asset}. User has {len(user_vaults)} vaults total.")
    logger.info(f"Finding best yield for asset: {target_asset} with risk <= {MAX_MVP_RISK_SCORE}")
    relevant_available_pools = [p for p in available_pools if p.asset == target_asset]
    safe_available_pools= [p for p in relevant_available_pools if p.risk_score <= MAX_MVP_RISK_SCORE]

    best_available_pool: Optional[YieldPool] = None
    if safe_available_pools:
        best_available_pool = max(safe_available_pools, key = lambda pool: pool.current_apy)
        logger.info(f"Engine: Best available safe pool: {best_available_pool.pool_id} @ {best_available_pool.current_apy:.2f}% APY")
    else:
        logger.warning(f"Engine: No safe available pools found for {target_asset}.")
        # If no external safe options exist, return a NO_SUGGESTION fact
        return SuggestionFact(
            suggestion_type="NO_SUGGESTION",
            asset=target_asset,
            reasoning=f"Could not find suitable yield opportunities under risk score {MAX_MVP_RISK_SCORE}."
        )

   # 2. Find the user's *current best* APY for the target asset in *unlocked* vaults
    # We use the data fetched from the backend API (user_vaults)
    user_current_unlocked_vaults_asset = [
        uv for uv in user_vaults if uv.token == target_asset and not uv.locked
    ]

    user_current_best_apy: float = 0.0 # Default to 0 if none found or all locked
    current_best_vault_name: Optional[str] = None
    user_has_asset_in_vault = any(uv.token == target_asset for uv in user_vaults)

    if user_current_unlocked_vaults_asset:
        # Find the vault with the maximum yieldRate among unlocked ones for the target asset
        best_current_unlocked = max(user_current_unlocked_vaults_asset, key=lambda v: v.yieldRate)
        # Convert yieldRate (e.g., 0.10) to percentage APY (e.g., 10.0)
        user_current_best_apy = best_current_unlocked.yieldRate * 100
        current_best_vault_name = best_current_unlocked.name
        logger.info(f"Engine: User's best current *unlocked* APY for {target_asset} is {user_current_best_apy:.2f}% in vault '{current_best_vault_name}'")
    else:
        logger.info(f"Engine: User has no *unlocked* vaults for {target_asset}. Treating current APY as 0.")
        # user_current_best_apy remains 0.0

    # 3. Decision Logic
    apy_improvement_threshold = 0.5 # Suggest move only if gain is > 0.5% APY

    # Scenario 1: User has unlocked funds, and a better external option exists
    if user_current_unlocked_vaults_asset and best_available_pool.current_apy > user_current_best_apy + apy_improvement_threshold:
        apy_gain = best_available_pool.current_apy - user_current_best_apy
        logger.info("Engine: Suggesting MOVE_TO_BETTER_YIELD")
        return SuggestionFact(
            suggestion_type="MOVE_TO_BETTER_YIELD",
            asset=target_asset,
            current_apy=user_current_best_apy,
            apy=best_available_pool.current_apy,
            apy_gain=apy_gain,
            protocol_name=best_available_pool.protocol_name,
            recommended_pool_id=best_available_pool.pool_id,
            reasoning=f"Found a stable option with {apy_gain:.1f}% higher APY."
        )

    # Scenario 2: User has no funds (or only locked funds) for this asset, suggest best initial deposit
    elif not user_has_asset_in_vault or not user_unlocked_vaults_asset:
         logger.info("Engine: Suggesting DEPOSIT_TO_BEST")
         return SuggestionFact(
            suggestion_type="DEPOSIT_TO_BEST",
            asset=target_asset,
            apy=best_available_pool.current_apy,
            protocol_name=best_available_pool.protocol_name,
            recommended_pool_id=best_available_pool.pool_id,
            reasoning=f"Found a good starting yield opportunity at {best_available_pool.current_apy:.1f}% APY."
         )

    # Scenario 3: User has unlocked funds, but no significantly better external option exists
    else: # Implies user_unlocked_vaults_asset exists and the external option isn't much better
        logger.info("Engine: Suggesting HOLD_CURRENT")
        return SuggestionFact(
            suggestion_type="HOLD_CURRENT",
            asset=target_asset,
            current_apy=user_current_best_apy,
            apy=user_current_best_apy, # Current and target APY are the same
            protocol_name=current_best_vault_name or "your current vault",
            reasoning="Your current unlocked vault offers a competitive yield right now."
        )

def analyze_chat_intent(message: str) -> Optional[Dict[str, Any]]:
    """
    Placeholder: Analyzes user chat message to extract structured action intents.
    In a real implementation, this could use NLP (like spaCy, regex) or prompt the LLM itself
    to classify the intent and extract parameters (amount, token, vault, etc.).
    """
    logger.debug(f"Engine: Analyzing chat intent for message: '{message}'")
    # Simple keyword matching for MVP demo
    message_lower = message.lower()
    if "deposit" in message_lower or "allocate" in message_lower or "put" in message_lower:
        # TODO: Extract amount and token using regex or NLP
        amount = 100.0 # Placeholder
        token = "USDC" # Placeholder
        if "usdc" in message_lower: token = "USDC"
        elif "usdt" in message_lower: token = "USDT"
        elif "sol" in message_lower: token = "SOL"

        logger.info("Engine: Detected DEPOSIT_VAULT intent (placeholder).")
        return {"action_type": "DEPOSIT_VAULT", "amount": amount, "token": token}

    elif "swap" in message_lower or "exchange" in message_lower or "trade" in message_lower:
         # TODO: Extract from_token, to_token, amount
         logger.info("Engine: Detected SWAP_TOKENS intent (placeholder).")
         return {"action_type": "SWAP_TOKENS", "from_token": "USDC", "to_token": "SOL", "amount": 50.0}

    # Add more intent detections (withdraw, check balance specifics, etc.)

    logger.debug("Engine: No specific action intent detected.")
    return None 