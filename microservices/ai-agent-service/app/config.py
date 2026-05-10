import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    SERVICE_TOKEN: str = ""
    
    ORDER_SERVICE_URL: str = "http://order-service:8002"
    USER_SERVICE_URL: str = "http://user-service:5000"
    RESTAURANT_SERVICE_URL: str = "http://restaurant-service:8001/api/v1"
    
    PORT: int = 8004
    DEBUG: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
