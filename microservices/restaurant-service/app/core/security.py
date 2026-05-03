from typing import Optional
import json
import base64
from passlib.context import CryptContext
from app.core.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = settings.ALGORITHM


def get_password_hash(password: str) -> str:
    """Hash password with bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode JWT access token without signature verification."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        payload_segment = parts[1]
        padded = payload_segment + "=" * (-len(payload_segment) % 4)
        payload_bytes = base64.urlsafe_b64decode(padded.encode("utf-8"))
        payload = json.loads(payload_bytes.decode("utf-8"))
        return payload
    except (ValueError, json.JSONDecodeError):
        return None
