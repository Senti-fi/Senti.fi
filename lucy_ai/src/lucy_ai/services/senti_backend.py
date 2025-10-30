import httpx
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ValidationError
import asyncio 
from fastapi import HTTPException

try:
    from ..main import settings
except ImportError:
    class MockSettings:
        SENTI_BACKEND_API_URL: str = "http://localhost:5000/api" 
    settings = MockSettings()


logger = logging.getLogger(__name__)

class UserVaultData(BaseModel):
    id: str 
    token: str 
    totalDeposits: float 
    yieldRate: float 
    locked: bool 
    lockPeriodDays: Optional[int] = None 

class RewardResponse(BaseModel):
    vault_pubkey: str
    accrued_rewards: float
    asset: str

async def get_user_vaults(user_id: str, auth_token: str) -> List[UserVaultData]:
    """
    Fetches all vaults associated with a user ID from the Senti Backend API.
    Makes a GET request to /api/vault/user/:userId
    """
    url = f"{settings.SENTI_BACKEND_API_URL}/vault/user/{user_id}"
    headers = {"Authorization": f"Bearer {auth_token}"}
    logger.info(f"Attempting to fetch vaults for user_id: {user_id} from {url}")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client: 
            response = await client.get(url, headers=headers)
            response.raise_for_status() 
            if response.status_code == 401:
                 logger.error(f"Authentication failed (401) fetching vaults for user {user_id}. Token might be invalid or expired.")
                 raise HTTPException(status_code=401, detail="Authentication failed. Invalid or expired token.")
            # Keep 404 check
            if response.status_code == 404:
                logger.info(f"No vaults found (404) for user {user_id}. Returning empty list.")
                return []
            raw_data = response.json()
            logger.debug(f"Received raw vault data for user {user_id}: {raw_data}")

            try:
                validated_vaults = [VaultResponse.model_validate(vault).model_dump(by_alias=True) for vault in raw_data]
                logger.info(f"Successfully fetched and validated {len(validated_vaults)} vaults for user {user_id}")
                return validated_vaults
            except ValidationError as e:
                logger.error(f"Data validation error for user vaults {user_id}: {e}")
                return raw_data 
            except Exception as e:
                logger.error(f"Unexpected error processing vault data for user {user_id}: {e}", exc_info=True)
                raise 

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error fetching vaults for user {user_id}: Status {e.response.status_code}, Response: {e.response.text}")
        if e.response.status_code == 404:
            return [] # User might have no vaults yet
        # For other errors, re-raise or return empty list based on desired behavior
        raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch user vaults: {e.response.text}") from e
    except httpx.RequestError as e:
        logger.error(f"Network error fetching vaults for user {user_id}: {e}")
        raise HTTPException(status_code=503, detail=f"Could not connect to Senti backend: {e}") from e
    except Exception as e:
        logger.error(f"Unexpected error fetching vaults for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while fetching user vaults.") from e


async def get_vault_rewards(vault_pubkey: str, auth_token: str) -> Optional[Dict[str, Any]]:
    """
    Fetches accrued rewards for a specific vault from the Senti Backend API.
    Makes a GET request to /api/vault/rewards/:vaultPubkey
    """
    url = f"{settings.SENTI_BACKEND_API_URL}/vault/rewards/{vault_pubkey}"
    headers = {"Authorization": f"Bearer {auth_token}"}
    logger.info(f"Attempting to fetch rewards for vault_pubkey: {vault_pubkey} from {url}")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client: 
            response = await client.get(url, headers=headers)

            if response.status_code == 404:
                logger.warn(f"No rewards found (404) for vault {vault_pubkey}")
                return None 

            response.raise_for_status() 

            raw_data = response.json()
            logger.debug(f"Received raw reward data for vault {vault_pubkey}: {raw_data}")


            try:
                validated_reward = RewardResponse.model_validate(raw_data).model_dump(by_alias=True)
                logger.info(f"Successfully fetched rewards for vault {vault_pubkey}")
                return validated_reward
            except ValidationError as e:
                logger.error(f"Data validation error for vault rewards {vault_pubkey}: {e}")
                return raw_data
            except Exception as e:
                logger.error(f"Unexpected error processing reward data for vault {vault_pubkey}: {e}", exc_info=True)
                raise

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error fetching rewards for vault {vault_pubkey}: Status {e.response.status_code}, Response: {e.response.text}")

        raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch vault rewards: {e.response.text}") from e
    except httpx.RequestError as e:
        logger.error(f"Network error fetching rewards for vault {vault_pubkey}: {e}")
        raise HTTPException(status_code=503, detail=f"Could not connect to Senti backend: {e}") from e
    except Exception as e:
        logger.error(f"Unexpected error fetching rewards for vault {vault_pubkey}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while fetching vault rewards.") from e

