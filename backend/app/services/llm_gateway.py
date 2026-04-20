from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import get_settings


class LLMGatewayError(RuntimeError):
    pass


def _extract_json_object(raw_text: str) -> dict[str, Any]:
    text = raw_text.strip()
    if not text:
        raise LLMGatewayError("Empty LLM response.")

    if "```" in text:
        text = text.replace("```json", "```")
        parts = [part.strip() for part in text.split("```") if part.strip()]
        for part in parts:
            if part.startswith("{") and part.endswith("}"):
                text = part
                break

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise LLMGatewayError("LLM did not return JSON object.")

    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise LLMGatewayError(f"Invalid JSON returned by LLM: {exc}") from exc


def _anthropic_chat_json(
    *,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
) -> dict[str, Any]:
    payload = {
        "model": model,
        "max_tokens": 1800,
        "temperature": temperature,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    response = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers=headers,
        json=payload,
        timeout=45.0,
    )
    if response.status_code >= 400:
        raise LLMGatewayError(f"anthropic {response.status_code}: {response.text}")
    data = response.json()
    content_blocks = data.get("content", [])
    raw_text = "".join(block.get("text", "") for block in content_blocks if isinstance(block, dict))
    return _extract_json_object(raw_text)


def _mistral_chat_json(
    *,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
) -> dict[str, Any]:
    payload = {
        "model": model,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    response = httpx.post(
        "https://api.mistral.ai/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=45.0,
    )
    if response.status_code >= 400:
        raise LLMGatewayError(f"mistral {response.status_code}: {response.text}")
    data = response.json()
    raw_text = data["choices"][0]["message"]["content"]
    return _extract_json_object(raw_text)


def _call_provider(
    *,
    provider: str,
    use_case: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
) -> tuple[dict[str, Any], str]:
    settings = get_settings()
    p = provider.strip().lower()
    if p == "anthropic":
        api_key = settings.anthropic_api_key
        model = settings.anthropic_model_import if use_case == "import" else settings.anthropic_model_hubert
        if not api_key:
            raise LLMGatewayError("ANTHROPIC_API_KEY is missing.")
        return (
            _anthropic_chat_json(
                api_key=api_key,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
            ),
            model,
        )

    if p == "mistral":
        api_key = settings.mistral_api_key
        model = settings.mistral_model_import if use_case == "import" else settings.mistral_model_hubert
        if not api_key:
            raise LLMGatewayError("MISTRAL_API_KEY is missing.")
        return (
            _mistral_chat_json(
                api_key=api_key,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
            ),
            model,
        )

    raise LLMGatewayError(f"Unsupported LLM provider: {provider}")


def chat_json_with_fallback(
    *,
    use_case: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
) -> tuple[dict[str, Any], str]:
    settings = get_settings()
    errors: list[str] = []

    for provider in (settings.llm_primary_provider, settings.llm_fallback_provider):
        try:
            payload, model = _call_provider(
                provider=provider,
                use_case=use_case,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
            )
            return payload, model
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{provider}: {exc}")

    raise LLMGatewayError("All configured LLM providers failed: " + " | ".join(errors))
