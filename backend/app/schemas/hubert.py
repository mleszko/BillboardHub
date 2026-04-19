from pydantic import BaseModel, Field


class HubertRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5_000)
    conversation_id: str | None = None
    mode: str = "auth"


class HubertResponse(BaseModel):
    conversation_id: str | None = None
    response: str
    mode: str
