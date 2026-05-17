from fastapi import Request, HTTPException, status
from app.config import settings
import base64
import json

def _decode_jwt_payload_safe(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) == 3:
            payload_b64 = parts[1]
            payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
            payload_json = base64.urlsafe_b64decode(payload_b64).decode('utf-8')
            return json.loads(payload_json)
    except:
        pass
    return {}

def verify_service_token(request: Request) -> None:
    # 1. Asegurar validación del service token que inyecta el gateway
    token = request.headers.get("x-service-token")
    if not token or token != settings.SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Falta o es inválido el X-Service-Token interno"
        )
        
    # 2. Comprobar el rol de admin del JWT que el gateway dejó pasar
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Requiere token JWT de acceso (Bearer token) para validar el rol"
        )
    
    jwt_token = auth_header.split(" ")[1]
    payload = _decode_jwt_payload_safe(jwt_token)
    
    user_role = payload.get("role") or payload.get("rol")
    if user_role != "admin" and user_role != "ADMIN":
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Acceso denegado. Se requiere rol de administrador. Rol proporcionado: {user_role}"
        )
