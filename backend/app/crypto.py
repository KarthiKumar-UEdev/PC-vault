from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

_fernet = Fernet(settings.fernet_key.encode())


def encrypt(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    return _fernet.encrypt(value.encode()).decode()


def decrypt(token: str | None) -> str | None:
    if token is None or token == "":
        return None
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        # Key rotated or corrupt ciphertext — surface a marker, not a 500.
        return "<decryption failed>"
