from pydantic import BaseModel


class MediaTokenRead(BaseModel):
    token: str
    expires_in: int
