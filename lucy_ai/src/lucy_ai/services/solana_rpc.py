import logging
from typing import List, Optional, Dict, Any
import asyncio
import httpx  
import random
from decimal import Decimal

try:
    from solders.pubkey import Pubkey
    from solana.rpc.async_api import AsyncClient
    from solana.rpc.types import TokenAccountOpts, Commitment
    from solana.exceptions import SolanaRpcException
except ImportError:
    logger.error("Failed to import 'solana' library. Please install it with 'pip install solana'")
    raise ImportError("Please install the 'solana' library: pip install solana")

from fastapi import HTTPException
from pydantic import ValidationError
try:
    from ..api.schemas import TokenBalance, WalletBalanceResponse, YieldPool
except ImportError:
    # Handle standalone execution for testing
    logger.warning("Could not import schemas from ..api.schemas. Using dummy models for standalone test.")
    class TokenBalance(BaseModel): pass
    class WalletBalanceResponse(BaseModel): pass
    class YieldPool(BaseModel): pass

try:
    from ..main import settings
except ImportError:
    logger.warning("Could not import settings from ..main. Using MockSettings.")
    class MockSettings:
        SOLANA_RPC_URL: str = "https://api.devnet.solana.com"
    settings = MockSettings()

logger = logging.getLogger(__name__)

KNOWN_TOKENS = {
    "USDC": Pubkey.from_string("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"), # <-- DEVNET USDC
    "USDT": Pubkey.from_string("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), # <-- DEVNET USDT
}

TOKEN_DECIMALS = {
    "USDC": 6,
    "USDT": 6,
    "SOL": 9, 
}


TOKEN_API_IDS = {
    "SOL": "solana",
    "USDC": "usd-coin",
    "USDT": "tether",
}

MOCK_LIVE_POOLS_DATA: List[Dict[str, Any]] = [
    {"pool_id": "solend_usdc_sol_mock", "protocol_name": "Solend (Solana)", "asset": "USDC", "current_apy": 6.2, "risk_score": 3},
    {"pool_id": "solend_usdt_sol_mock", "protocol_name": "Solend (Solana)", "asset": "USDT", "current_apy": 6.5, "risk_score": 3},
    {"pool_id": "marinade_sol_sol_mock", "protocol_name": "Marinade Staking", "asset": "SOL", "current_apy": 7.0, "risk_score": 2},
]


async def get_wallet_balances(wallet_address: str) -> Optional[WalletBalanceResponse]:
    """
    Fetches SOL and known SPL token balances for a given wallet address via Solana RPC.
    """
    logger.info(f"Solana RPC: Fetching balances for wallet: {wallet_address}")
    try:
        owner_pubkey = Pubkey.from_string(wallet_address)
    except (ValueError, TypeError): 
        logger.error(f"Solana RPC: Invalid wallet address format: {wallet_address}")
        raise HTTPException(status_code=400, detail="Invalid wallet address format provided.")

    token_balances: List[TokenBalance] = []
    rpc_url = settings.SOLANA_RPC_URL
    if not rpc_url:
        logger.error("Solana RPC: SOLANA_RPC_URL is not configured.")
        raise HTTPException(status_code=500, detail="Solana RPC endpoint not configured.")

    logger.debug(f"Solana RPC: Connecting to {rpc_url}")
    commitment: Commitment = "confirmed" 

    try:
        async with AsyncClient(rpc_url, commitment=commitment) as client:
            is_alive = await client.is_connected()
            if not is_alive:
                 logger.error(f"Solana RPC: Failed to connect to RPC: {rpc_url}")
                 raise HTTPException(status_code=503, detail="Could not connect to Solana RPC.")

            try:
                sol_balance_resp = await client.get_balance(owner_pubkey)
                if sol_balance_resp.value is not None:
                    sol_raw = sol_balance_resp.value
                    sol_ui = Decimal(sol_raw) / (Decimal(10)**TOKEN_DECIMALS["SOL"])
                    token_balances.append(TokenBalance(
                        token_symbol="SOL",
                        amount_ui=float(sol_ui.quantize(Decimal('0.0001'))), 
                        amount_raw=str(sol_raw)
                    ))
                    logger.debug(f"Solana RPC: Found SOL balance: {sol_ui}")
                else:
                     logger.warning(f"Solana RPC: SOL balance RPC returned None for {wallet_address}")
            except SolanaRpcException as e:
                 logger.error(f"Solana RPC: RPC Error (SOL balance) for {wallet_address}: {e}")

            except Exception as e:
                 logger.error(f"Solana RPC: Unexpected error (SOL balance): {e}", exc_info=True)

            for symbol, mint_pubkey in KNOWN_TOKENS.items():
                try:
                    opts = TokenAccountOpts(mint=mint_pubkey)
                    token_accounts_resp = await client.get_token_accounts_by_owner(owner_pubkey, opts=opts)

                    total_balance_raw = 0
                    if token_accounts_resp.value:
                        logger.debug(f"Found {len(token_accounts_resp.value)} token account(s) for {symbol}")
                        balance_tasks = [client.get_token_account_balance(acc.pubkey) for acc in token_accounts_resp.value]
                        balance_responses = await asyncio.gather(*balance_tasks, return_exceptions=True)
                        
                        for resp in balance_responses:
                            if isinstance(resp, SolanaRpcException):
                                logger.warning(f"Solana RPC: RPC error (token balance) for {symbol}: {resp}")
                            elif isinstance(resp, Exception):
                                logger.warning(f"Solana RPC: Unexpected error (token balance) for {symbol}: {resp}", exc_info=True)
                            elif resp.value and resp.value.amount:
                                try:
                                    amount_int = int(resp.value.amount)
                                    total_balance_raw += amount_int
                                except (ValueError, TypeError) as e_parse:
                                    logger.warning(f"Solana RPC: Error parsing balance amount '{resp.value.amount}': {e_parse}")
                            else:
                                logger.warning(f"Solana RPC: No balance amount found for {symbol} account.")

                    decimals = TOKEN_DECIMALS.get(symbol, 0)
                    balance_ui = Decimal(total_balance_raw) / (Decimal(10)**decimals) if decimals > 0 else Decimal(total_balance_raw)

                    if total_balance_raw > 0:
                        token_balances.append(TokenBalance(
                            token_symbol=symbol,
                            amount_ui=float(balance_ui.quantize(Decimal('0.0001'))),
                            amount_raw=str(total_balance_raw),
                            token_mint=str(mint_pubkey)
                        ))
                        logger.debug(f"Solana RPC: Found {symbol} total balance: {balance_ui}")
                    else:
                        logger.debug(f"Solana RPC: No non-zero balance found for {symbol}")
                except SolanaRpcException as e:
                     logger.error(f"Solana RPC: RPC Error (token accounts) for {symbol} / {wallet_address}: {e}")
                except Exception as e: 
                     logger.error(f"Solana RPC: Unexpected error (token accounts) for {symbol}: {e}", exc_info=True)
        if not token_balances:
             logger.warning(f"Solana RPC: Found no SOL or known SPL balances for {wallet_address}")
             return WalletBalanceResponse(wallet_address=wallet_address, balances=[])

        logger.info(f"Solana RPC: Successfully fetched {len(token_balances)} balance(s) for {wallet_address}")
        return WalletBalanceResponse(wallet_address=wallet_address, balances=token_balances)

    except SolanaRpcException as e:
        logger.error(f"Solana RPC: Solana RPC Error during balance fetch for {wallet_address}: {e}")
        raise HTTPException(status_code=503, detail=f"Solana RPC Error: Could not connect or fetch data.") from e
    except Exception as e:
        logger.error(f"Solana RPC: Unexpected error in get_wallet_balances: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unexpected error fetching wallet balances.") from e


async def get_token_prices(token_symbols: List[str]) -> Dict[str, Optional[float]]:
    """
    Fetches the current USD price for given token symbols using CoinGecko's free API.
    Returns prices as floats.
    """
    prices: Dict[str, Optional[float]] = {symbol: None for symbol in token_symbols}
    api_ids_to_fetch = [TOKEN_API_IDS.get(s) for s in token_symbols if TOKEN_API_IDS.get(s)]

    if not api_ids_to_fetch:
        logger.warning("Price Service: No valid CoinGecko API IDs found for requested symbols.")
        return prices

    ids_param = ",".join(list(set(api_ids_to_fetch)))
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids_param}&vs_currencies=usd"
    logger.info(f"Price Service: Fetching prices from CoinGecko for IDs: {ids_param}")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            logger.debug(f"Price Service: Received price data: {data}")

            for symbol in token_symbols:
                api_id = TOKEN_API_IDS.get(symbol)
                if api_id and api_id in data and "usd" in data[api_id]:
                    try:
                        prices[symbol] = float(data[api_id]["usd"])
                    except (ValueError, TypeError):
                         logger.error(f"Price Service: Could not convert price for {symbol} to float: {data[api_id]['usd']}")

    except httpx.HTTPStatusError as e:
        logger.error(f"Price Service: HTTP error fetching prices from CoinGecko: Status {e.response.status_code}, Response: {e.response.text}")
    except httpx.RequestError as e:
        logger.error(f"Price Service: Network error fetching prices from CoinGecko: {e}")
    except (KeyError, ValueError, TypeError) as e:
         logger.error(f"Price Service: Error parsing price data from CoinGecko: {e}")
    except Exception as e:
        logger.error(f"Price Service: Unexpected error fetching prices: {e}", exc_info=True)


    logger.info(f"Price Service: Fetched prices: {prices}")
    return prices


async def get_live_yield_opportunities() -> List[YieldPool]:
    """
    Placeholder: Fetches live yield data for various pools/protocols.
    Requires querying specific DeFi protocol state accounts and parsing their data.
    """
    logger.info("Solana RPC: Mock fetching live yield opportunities")
    await asyncio.sleep(0.1) 
    # --- Real Implementation Sketch ---
    # async with AsyncClient(settings.SOLANA_RPC_URL) as client:
    #     # 1. Query known protocol state accounts (e.g., Solend, Marinade)
    #     # 2. Deserialize their data (requires protocol-specific layouts/IDLs)
    #     # 3. Calculate current APY based on deserialized state
    #     # 4. Format into YieldPool objects
    #     # Example (very simplified):
    #     # solend_state = await get_and_deserialize_solend_state(client)
    #     # usdc_apy = calculate_solend_usdc_apy(solend_state)
    #     # results.append(YieldPool(pool_id="solend_usdc_sol_live", ..., current_apy=usdc_apy, risk_score=3))
    # --------------------------------

    # Return mock data for the MVP
    try:
        mock_pools = [YieldPool.model_validate(pool_data) for pool_data in MOCK_LIVE_POOLS_DATA]
        return mock_pools
    except ValidationError as e:
         logger.error(f"Solana RPC: Error validating mock pool data: {e}")
         return [] 