from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AppMode, HubertConversation, HubertMessage
from app.schemas.hubert import HubertRequest, HubertResponse
from app.services.llm_gateway import chat_json_with_fallback

DOMAIN_GUARDRAIL = """
You are Hubert, a specialized advisor for BillboardHub.
You may only discuss:
- billboard operations
- outdoor advertising ROI
- property and location strategy for billboard placement
If asked anything else, politely refuse and redirect to billboard/ROI/property topics.
"""

DEMO_STYLE_GUIDE = """
In DEMO mode your tone should be gamified, uplifting and energetic in Polish.
Use playful titles like "Bialostocki Baron Bilbordow" naturally when appropriate.
Never invent legal guarantees or financial certainty.
"""


class DemoModeOnlyError(ValueError):
    pass


def _default_demo_reply() -> str:
    return (
        "Jestes na trasie po korone ROI, Bialostocki Baron Bilbordow! "
        "Podaj mi lokalizacje, koszt najmu i przewidywany ruch, a policze "
        "strategiczny potencjal nosnika krok po kroku."
    )


class HubertService:
    async def _persist_message(
        self,
        db: AsyncSession,
        conversation_id: str,
        owner_user_id: str,
        role: str,
        content: str,
    ) -> None:
        db.add(
            HubertMessage(
                conversation_id=conversation_id,
                owner_user_id=owner_user_id,
                role=role,
                content=content,
            )
        )

    async def chat(self, db: AsyncSession, request: HubertRequest, user_id: str) -> HubertResponse:
        if request.mode != "demo":
            raise DemoModeOnlyError("Hubert is available in Demo mode only.")

        conversation_id = request.conversation_id
        if not conversation_id:
            conversation = HubertConversation(
                owner_user_id=user_id,
                mode=AppMode.demo,
                title="Hubert Demo Conversation",
                system_prompt_version="v1",
            )
            db.add(conversation)
            await db.flush()
            conversation_id = conversation.id

        await self._persist_message(
            db=db,
            conversation_id=conversation_id,
            owner_user_id=user_id,
            role="user",
            content=request.message,
        )

        try:
            payload, _used_model = chat_json_with_fallback(
                use_case="hubert",
                system_prompt=(
                    f"{DOMAIN_GUARDRAIL}\n{DEMO_STYLE_GUIDE}\n"
                    "Always answer in Polish. Return JSON with key 'response'."
                ),
                user_prompt=request.message,
                temperature=0.7,
            )
            reply = str(payload.get("response") or "").strip() or _default_demo_reply()
        except Exception:  # noqa: BLE001
            reply = _default_demo_reply()

        await self._persist_message(
            db=db,
            conversation_id=conversation_id,
            owner_user_id=user_id,
            role="assistant",
            content=reply,
        )
        await db.commit()

        return HubertResponse(
            conversation_id=conversation_id,
            response=reply,
            mode=request.mode,
        )


hubert_service = HubertService()
