import os
import logging
from typing import Optional, Any, Dict
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from fastapi import HTTPException
from ..api.schemas import SuggestionFact, DepositActionIntent, SwapActionIntent, AnyActionIntent
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
LLM_MODEL_NAME_OPENAI = os.getenv("LLM_MODEL_NAME_OPENAI", "gpt-4o-mini")
LLM_MODEL_NAME_GEMINI = os.getenv("LLM_MODEL_NAME_GEMINI", "gemini-1.5-flash-latest")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

llm = None
llm_with_tools = None
llm_provider = "None (Using Fallback)" 

if OPENAI_API_KEY:
    try:
        llm = ChatOpenAI(model=LLM_MODEL_NAME_OPENAI, temperature=0.7, openai_api_key=OPENAI_API_KEY)
        llm_provider = f"OpenAI ({LLM_MODEL_NAME_OPENAI})"
        logger.info(f"Initialized LLM with {llm_provider}")
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI LLM: {e}. Trying Google Gemini.")
        llm = None

# If OpenAI failed or key not set, try Google Gemini
if llm is None and GOOGLE_API_KEY:
    try:
        llm = ChatGoogleGenerativeAI(model=LLM_MODEL_NAME_GEMINI, temperature=0.7, google_api_key=GOOGLE_API_KEY)
        llm_provider = f"Google Gemini ({LLM_MODEL_NAME_GEMINI})"
        logger.info(f"Initialized LLM with {llm_provider}")
    except Exception as e:
        logger.error(f"Failed to initialize Google Gemini LLM: {e}")
        llm = None 

if llm is None:
    logger.warning("Neither OpenAI nor Google API Key found or LLM initialization failed. LLM features disabled.")
else:
    try:
        ACTION_TOOLS = [DepositActionIntent, SwapActionIntent]
        llm_with_tools = llm.bind_tools(ACTION_TOOLS)
        logger.info("Successfully bound action tools (DepositActionIntent, SwapActionIntent) to LLM.")
    except Exception as e:
        logger.error(f"Failed to bind tools to LLM: {e}", exc_info=True)
        llm_with_tools = None

def get_llm_info() -> str:
    """Returns information about the initialized LLM."""
    return llm_provider


LUCY_BASE_PROMPT = """
You are 'Lucy,' a friendly, calm, and informed financial AI co-pilot for the Senti platform. Your goal is to translate structured financial data into a simple, reassuring, and actionable suggestion for the user. Use natural language, avoid jargon. Keep it concise (1-2 sentences).
"""

SUGGESTION_PROMPT_TEMPLATE = ChatPromptTemplate.from_messages([
    ("system", LUCY_BASE_PROMPT + " Generate a concise suggestion based on the following analysis data."),
    ("human", """
    Analysis Data:
    ```json
    {suggestion_data}
    ```
    Please formulate a friendly message for the user based on the `suggestion_type`:
    - If "MOVE_TO_BETTER_YIELD": Emphasize the APY gain (e.g., "earn +{apy_gain:.1f}% more") and mention the {protocol_name}.
    - If "HOLD_CURRENT": Reassure the user their current unlocked vault ('{protocol_name}') is performing well at {apy:.1f}% APY.
    - If "DEPOSIT_TO_BEST": Recommend depositing {asset} to {protocol_name} to start earning {apy:.1f}% APY.
    - If "NO_SUGGESTION": Gently inform the user there are no better safe options matching their risk profile right now.
    - If "ERROR": Apologize that an error occurred while analyzing options.
    """)
])

CHAT_PROMPT_TEMPLATE = ChatPromptTemplate.from_messages([
    ("system", LUCY_BASE_PROMPT + """
You are now in a conversational chat mode.
- Use the "Current User Context" provided below to answer the user's questions about their balances, vaults, and status.
- The context contains "User's Vaults" (money they have deposited in Senti) and "User's Wallet Balances" (money in their personal wallet).
- If the user asks to perform an action (e.g., "deposit $100", "swap SOL to USDC"), you MUST use the provided tools (`DepositActionIntent` or `SwapActionIntent`).
- Fill in the tool parameters (like `amount`, `token`) based on the user's message.
- If details are missing (e.g., "I want to deposit"), ask for them in your text response.
- ALWAYS provide a friendly text response in addition to using a tool.
- **NEW RULE:** If the user's requested action (like a deposit) is not directly possible, but you identify a necessary **prerequisite action** (like a swap), you must **proactively return the tool call for that prerequisite action** (e.g., `SwapActionIntent`). Your text response should explain why this new action is necessary (e.g., "To do that, you'll first need to swap...").
"""),
    ("human", """
User Message: {user_message}

Current User Context:
{user_context}
""")
])


output_parser = StrOutputParser()
suggestion_chain = None
chat_chain = None

if llm:
    try:
        suggestion_chain = SUGGESTION_PROMPT_TEMPLATE | llm | output_parser
        if llm_with_tools:
            chat_chain = CHAT_PROMPT_TEMPLATE | llm_with_tools
            logger.info(f"Langchain chat chain created with tools using {llm_provider}.")
        else:
            logger.warning("Tool-bound LLM not available. Chat chain will be text-only.")
            chat_chain = CHAT_PROMPT_TEMPLATE | llm | output_parser
    except Exception as e:
        logger.error(f"Failed to create Langchain chains: {e}", exc_info=True)
else:
    logger.warning("LLM chains could not be created as no LLM is available.")

async def generate_nlp_suggestion(fact: SuggestionFact) -> str:
    """Generates NLP text for a pre-calculated SuggestionFact."""
    if not suggestion_chain:
        logger.warning("LLM chain is not available. Using fallback for suggestions.")
        
        # --- UPDATED FALLBACK LOGIC ---
        try:
            if fact.suggestion_type == "MOVE_TO_BETTER_YIELD":
                return f"You could earn ~{fact.apy_gain:.1f}% more APY by moving your {fact.asset} from your current vault (at {fact.current_apy:.1f}%) to {fact.protocol_name} (at {fact.apy:.1f}%)."
            elif fact.suggestion_type == "HOLD_CURRENT":
                return f"Your current {fact.asset} vault '{fact.protocol_name}' is performing well at {fact.apy:.1f}% APY. Holding seems like a good strategy for now."
            elif fact.suggestion_type == "DEPOSIT_TO_BEST":
                return f"Found a good starting opportunity for your {fact.asset} with {fact.protocol_name} offering around {fact.apy:.1f}% APY."
            elif fact.suggestion_type == "NO_SUGGESTION":
                return f"Your current {fact.asset} positions look solid, and I couldn't find any significantly better safe opportunities right now."
            else: 
                return f"I had trouble analyzing the best options for your {fact.asset} right now. Please try again in a moment."
        except Exception as e:
            logger.error(f"Error in fallback suggestion formatting: {e}")
            return "Processing your financial options."
        

    try:
        
        fact_dict_str = fact.model_dump_json(indent=2, exclude_none=True)
        logger.info(f"Generating NLP suggestion for fact:\n{fact_dict_str}")

        response = await suggestion_chain.ainvoke({"suggestion_data": fact_dict_str})
        
        logger.info(f"LLM Response: {response}")
        return response.strip()

    except Exception as e:
        logger.error(f"Error generating NLP suggestion: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate AI suggestion text."
        ) from e


async def generate_chat_response(user_message: str, user_context: Optional[str] = None) -> Dict[str, Any]:
    """Generates a conversational response using the LLM, incorporating context."""
    if not chat_chain:
        logger.warning("Chat LLM chain not available. Returning generic fallback.")
        return {"text": "I'm currently unable to process chat messages. Please try again later.", "action_intent": None}

    if not llm_with_tools:
        logger.warning("Chat chain is in text-only fallback mode.")
        try:
            response_text = await chat_chain.ainvoke({"user_message": user_message, "user_context": user_context})
            return {"text": response_text.strip(), "action_intent": None}
        except Exception as e:
            logger.error(f"Error in text-only chat fallback: {e}", exc_info=True)
            return {"text": "Sorry, I encountered an issue while trying to respond.", "action_intent": None}

    context_str = user_context if user_context else "No specific context provided."

    try:
        logger.info(f"Generating chat response for message: '{user_message}'")
        logger.debug(f"Context provided to chat LLM:\n{context_str}")

        response = await chat_chain.ainvoke({
            "user_message": user_message,
            "user_context": context_str
        })
        ai_response_text = ""
        if isinstance(response.content, str):
            ai_response_text = response.content.strip()
        elif isinstance(response.content, list) and len(response.content) > 0:
            for part in response.content:
                if isinstance(part, dict) and part.get("type") == "text":
                    ai_response_text = part.get("text", "").strip()
                    break
            if not ai_response_text: 
                 ai_response_text = str(response.content)

        action_intent_result: Optional[AnyActionIntent] = None
        if response.tool_calls:
            try:
                tool_call = response.tool_calls[0] # Get the first tool
                tool_name = tool_call.get("name")
                tool_args = tool_call.get("args", {})
                
                logger.info(f"AI detected tool call: {tool_name} with args {tool_args}")
                
                # Match the tool name to your Pydantic schema
                if tool_name == "DepositActionIntent":
                    action_intent_result = DepositActionIntent(**tool_args)
                elif tool_name == "SwapActionIntent":
                    action_intent_result = SwapActionIntent(**tool_args)
                    
            except Exception as e:
                # If parsing the tool fails, log it but don't crash
                logger.error(f"Failed to parse AI tool call: {e}", exc_info=True)
                action_intent_result = None
                if not ai_response_text: # Ensure we at least send a text response
                    ai_response_text = "I understood your request but had a slight issue processing the details. Could you try rephrasing?"

        logger.info(f"LLM Chat Response: {ai_response_text}")
        if action_intent_result:
            logger.info(f"LLM Action Intent: {action_intent_result.model_dump()}")
            
        return {"text": ai_response_text, "action_intent": action_intent_result}

    except Exception as e:
        logger.error(f"Error generating chat response: {e}", exc_info=True)
        return {"text": "Sorry, I encountered an issue while trying to respond. Please try asking differently.", "action_intent": None}