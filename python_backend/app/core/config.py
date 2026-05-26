from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LABMANAGER_PY_",
        env_file=ENV_FILE,
        extra="ignore",
    )

    app_name: str = "LabManager Python Backend"
    app_env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8001
    log_level: str = "INFO"
    enable_docs: bool = True
    readiness_strict: bool = False
    schema_check_on_readiness: bool = False
    database_url: str | None = Field(default=None)
    redis_url: str | None = Field(default=None)
    celery_broker_url: str | None = Field(default=None)
    celery_result_backend: str | None = Field(default=None)
    langgraph_enabled: bool = False
    pdf_font_path: str | None = Field(default=None)
    llm_api_key: str | None = Field(default=None)
    llm_endpoint: str | None = Field(default=None)
    llm_model: str | None = Field(default=None)
    smtp_host: str | None = Field(default=None)
    smtp_port: int | None = Field(default=None)
    smtp_user: str | None = Field(default=None)
    smtp_password: str | None = Field(default=None)
    smtp_from: str | None = Field(default=None)
    smtp_use_ssl: bool = Field(default=False)
    supervisor_report_email: str | None = Field(default=None)
    supervisor_report_name: str = "Supervisor"
    supervisor_report_base_url: str | None = Field(default=None)
    report_near_low_stock_ratio: float = 0.25
    report_near_maintenance_days: int = 7
    report_fault_frequency_window_days: int = 30
    auth_token_secret: str = "labmanager-local-dev-auth-secret"

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() in {"dev", "development", "local", "test"}


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if not settings.is_development:
        settings.enable_docs = False
        if settings.readiness_strict is False:
            settings.readiness_strict = True
    return settings
