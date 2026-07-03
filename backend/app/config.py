from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

# Valid Fernet key used ONLY as a dev fallback so the app boots without a .env.
# Anything encrypted with it is trivially decryptable — set FERNET_KEY in prod.
_INSECURE_DEV_KEY = "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = f"sqlite:///{(BASE_DIR / 'pcvault.db').as_posix()}"
    fernet_key: str = _INSECURE_DEV_KEY

    # Role logins. Both empty (default) = auth disabled, API is open.
    # admin: full control. manager: view everything + approve/reject/comment
    # on planned builds. When MANAGER_PASSWORD is set, converting a build to
    # a real PC requires the manager's approval first.
    admin_password: str = ""
    manager_password: str = ""

    frontend_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000"

    smtp_host: str = "localhost"
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "pc-vault@localhost"
    alert_email_to: str = ""
    warranty_alert_days: int = 30

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
