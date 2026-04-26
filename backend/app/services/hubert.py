from __future__ import annotations

import json
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import PLACEHOLDER_CONTRACT_EXPIRY
from app.models.models import AppMode, Contract, HubertConversation, HubertMessage
from app.schemas.hubert import HubertRequest, HubertResponse
from app.services.llm_gateway import chat_json_with_fallback

DOMAIN_GUARDRAIL = """
You are Hubert, an expert advisor for BillboardHub.
You may only discuss:
- billboard operations and contracts
- outdoor advertising ROI and pricing
- property/location strategy for billboard placement
If asked anything outside those topics, politely refuse and redirect.
"""

AUTH_STYLE_GUIDE = """
In AUTH mode your tone should be practical and concise in Polish.
You can:
- explain how contract metrics are computed (monthly value, period value, expiry urgency),
- ask up to 3 precise clarifying questions before making location recommendations,
- evaluate billboard candidates by visibility and business value.
When evaluating locations, give a transparent scoring rubric and clearly mark assumptions.
Never invent legal guarantees or financial certainty.
"""

DEMO_STYLE_GUIDE = """
In DEMO mode your tone should be gamified, uplifting and energetic in Polish.
Use playful titles like "Bialostocki Baron Bilbordow" naturally when appropriate.
Never invent legal guarantees or financial certainty.
"""


def _normalize_mode(mode: str) -> AppMode:
    normalized = (mode or "").strip().lower()
    if normalized == AppMode.demo.value:
        return AppMode.demo
    return AppMode.auth


def _default_reply(mode: AppMode) -> str:
    if mode == AppMode.demo:
        return (
            "Jestes na trasie po korone ROI, Bialostocki Baron Bilbordow! "
            "Podaj mi lokalizacje, koszt najmu i przewidywany ruch, a policze "
            "strategiczny potencjal nosnika krok po kroku."
        )
    return (
        "Moge pomoc w analizie umow, metodzie obliczen oraz wyborze lokalizacji billboardu. "
        "Podaj prosze cel kampanii i 1-2 lokalizacje do porownania."
    )


async def _portfolio_context(db: AsyncSession, user_id: str) -> dict[str, Any]:
    result = await db.execute(
        select(Contract)
        .where(Contract.owner_user_id == user_id)
        .order_by(Contract.expiry_date.asc())
        .limit(250)
    )
    contracts = result.scalars().all()

    today = date.today()
    monthly_total = 0.0
    expiring_30 = 0
    cities: set[str] = set()
    sample_contracts: list[dict[str, Any]] = []

    for contract in contracts:
        monthly_total += float(contract.monthly_rent_net or 0)
        if contract.city:
            cities.add(contract.city.strip())

        expiry_unknown = contract.expiry_date == PLACEHOLDER_CONTRACT_EXPIRY
        days_to_expiry: int | None = None
        if not expiry_unknown:
            days_to_expiry = (contract.expiry_date - today).days
            if 0 <= days_to_expiry <= 30:
                expiring_30 += 1

        if len(sample_contracts) < 8:
            sample_contracts.append(
                {
                    "contract_number": contract.contract_number,
                    "advertiser_name": contract.advertiser_name,
                    "billboard_code": contract.billboard_code,
                    "city": contract.city,
                    "location_address": contract.location_address,
                    "billboard_type": contract.billboard_type.value if contract.billboard_type else None,
                    "monthly_rent_net": float(contract.monthly_rent_net or 0),
                    "expiry_unknown": expiry_unknown,
                    "days_to_expiry": days_to_expiry,
                }
            )

    return {
        "contracts_count": len(contracts),
        "monthly_value_net": round(monthly_total, 2),
        "expiring_30d_count": expiring_30,
        "cities": sorted(city for city in cities if city),
        "sample_contracts": sample_contracts,
        "calculation_hints": {
            "monthly_value_net": "sum(monthly_rent_net) for active contracts",
            "period_value": "contract months * monthly_rent_net unless contract total is provided",
            "expiry_unknown": "true means source file had no reliable end date",
        },
    }


def _system_prompt_for_mode(mode: AppMode) -> str:
    style = DEMO_STYLE_GUIDE if mode == AppMode.demo else AUTH_STYLE_GUIDE
    return (
        f"{DOMAIN_GUARDRAIL}\n"
        f"{style}\n"
        "Always answer in Polish. Return strict JSON with key 'response'.\n"
        "If data is insufficient, say what is missing and ask short follow-up questions.\n"
        "When user asks where to buy a billboard, ask targeted questions first, then provide recommendation criteria.\n"
        "When user asks for value/contract calculations, explain the formula step by step before giving numbers."
    )


def _user_prompt(message: str, portfolio: dict[str, Any]) -> str:
    return json.dumps(
        {
            "user_message": message,
            "portfolio_context": portfolio,
            "answer_schema": {"response": "string"},
        },
        ensure_ascii=True,
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
        mode = _normalize_mode(request.mode)
        conversation_id = request.conversation_id
        if not conversation_id:
            conversation = HubertConversation(
                owner_user_id=user_id,
                mode=mode,
                title="Hubert Conversation",
                system_prompt_version="v2",
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

        portfolio = await _portfolio_context(db=db, user_id=user_id)
        try:
            payload, _used_model = chat_json_with_fallback(
                use_case="hubert",
                system_prompt=_system_prompt_for_mode(mode),
                user_prompt=_user_prompt(request.message, portfolio),
                temperature=0.7 if mode == AppMode.demo else 0.35,
            )
            reply = str(payload.get("response") or "").strip() or _default_reply(mode)
        except Exception:  # noqa: BLE001
            reply = _default_reply(mode)

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
            mode=mode.value,
        )


hubert_service = HubertService()
