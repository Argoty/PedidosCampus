import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/ai/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "ai-agent-service"

def test_chat_requires_service_token():
    payload = {
        "message": "Hola, prueba de token",
        "session_id": "test_missing_token_session"
    }
    response = client.post("/ai/chat", json=payload)
    assert response.status_code == 403
    assert "X-Service-Token" in response.json()["detail"]

def test_chat_invalid_token():
    payload = {
        "message": "Hola, prueba de token",
        "session_id": "test_invalid_token_session"
    }
    headers = {"x-service-token": "invalid_wrong_token"}
    response = client.post("/ai/chat", json=payload, headers=headers)
    assert response.status_code == 403
    assert "invalid" in response.json()["detail"].lower() or "inválido" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_revenue_by_restaurant_tool(httpx_mock):
    from app.tools.agent_tools import get_revenue_by_restaurant
    from app.config import settings
    import json
    
    # Mocking order-service response
    mock_response = [
        {"id": 1, "restauranteId": "R1", "total": 15.5, "estado": "entregado"},
        {"id": 2, "restauranteId": "R1", "total": 10.0, "estado": "entregado"},
        {"id": 3, "restauranteId": "R2", "total": 50.0, "estado": "entregado"}
    ]
    
    httpx_mock.add_response(
        url=f"{settings.ORDER_SERVICE_URL}/orders?estado=entregado", 
        json=mock_response
    )
    
    # Execute tool
    result_str = await get_revenue_by_restaurant()
    result = json.loads(result_str.replace("'", '"')) # Simple eval conversion
    
    assert len(result) == 2
    
    # Results should be ordered by revenue desc
    assert result[0]["restauranteId"] == "R2"
    assert result[0]["ingresos"] == 50.0
    
    assert result[1]["restauranteId"] == "R1"
    assert result[1]["ingresos"] == 25.5
