import pytest
from uuid import uuid4

pytestmark = pytest.mark.asyncio


class TestRestaurantes:
    """Tests for Restaurant endpoints."""

    async def test_create_restaurante_admin(self, client, admin_token):
        """Test creating a restaurante as admin."""
        response = await client.post(
            "/api/v1/restaurants",
            json={
                "nombre": "El Buen Sabor",
                "descripcion": "Comida típica",
                "direccion": "Cra 5 # 10-20",
                "categoria": "Típica",
                "imagen_url": "https://example.com/img.jpg",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["nombre"] == "El Buen Sabor"
        assert data["is_active"] is True
        assert "id" in data

    async def test_create_restaurante_unauthorized(self, client, user_token):
        """Test that non-admin cannot create restaurante."""
        response = await client.post(
            "/api/v1/restaurants",
            json={
                "nombre": "Test",
                "direccion": "Test",
                "categoria": "Test",
            },
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 403

    async def test_create_restaurante_missing_required_fields(
        self, client, admin_token
    ):
        """Test validation of required fields."""
        response = await client.post(
            "/api/v1/restaurants",
            json={
                "nombre": "Test",
                # Missing direccion
                "categoria": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 422

    async def test_list_restaurantes(self, client, admin_token):
        """Test listing restaurantes."""
        # Create a restaurante first
        create_response = await client.post(
            "/api/v1/restaurants",
            json={
                "nombre": "Pizza Palace",
                "descripcion": "Pizzería",
                "direccion": "Cra 10 # 20-30",
                "categoria": "Pizzería",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert create_response.status_code == 201

        # List restaurantes
        response = await client.get("/api/v1/restaurants")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 1

    async def test_list_restaurantes_with_filters(self, client, admin_token):
        """Test filtering restaurantes."""
        # Create restaurantes with different categories
        await client.post(
            "/api/v1/restaurants",
            json={
                "nombre": "Pizzería Italia",
                "direccion": "Cra 5 # 10",
                "categoria": "Pizzería",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        await client.post(
            "/api/v1/restaurants",
            json={
                "nombre": "Burgues Deluxe",
                "direccion": "Cra 7 # 20",
                "categoria": "Burguesería",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # Filter by category
        response = await client.get("/api/v1/restaurants?categoria=Pizzería")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1

    async def test_get_restaurante_by_id(self, client, admin_token):
        """Test getting restaurante by ID with menu."""
        # Create restaurante
        create_response = await client.post(
            "/api/v1/restaurants",
            json={
                "nombre": "Tacos Mexicanos",
                "direccion": "Cra 15 # 30",
                "categoria": "Mexicana",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        restaurante_id = create_response.json()["id"]

        # Get restaurante
        response = await client.get(f"/api/v1/restaurants/{restaurante_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == restaurante_id
        assert data["nombre"] == "Tacos Mexicanos"
        assert "productos" in data

    async def test_get_restaurante_not_found(self, client):
        """Test getting non-existent restaurante."""
        response = await client.get(f"/api/v1/restaurants/{uuid4()}")
        assert response.status_code == 404

    async def test_update_restaurante(self, client, admin_token):
        """Test updating restaurante."""
        # Create
        create_response = await client.post(
            "/api/v1/restaurants",
            json={
                "nombre": "Original Name",
                "direccion": "Cra 1 # 1",
                "categoria": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        restaurante_id = create_response.json()["id"]

        # Update
        update_response = await client.patch(
            f"/api/v1/restaurants/{restaurante_id}",
            json={"nombre": "Updated Name"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["nombre"] == "Updated Name"

    async def test_activate_restaurante(self, client, admin_token):
        """Test activating restaurante."""
        # Create and deactivate
        create_response = await client.post(
            "/api/v1/restaurants",
            json={
                "nombre": "Test",
                "direccion": "Test",
                "categoria": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        restaurante_id = create_response.json()["id"]

        await client.post(
            f"/api/v1/restaurants/{restaurante_id}/deactivate",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # Activate
        response = await client.post(
            f"/api/v1/restaurants/{restaurante_id}/activate",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is True

    async def test_deactivate_restaurante(self, client, admin_token):
        """Test deactivating restaurante."""
        # Create
        create_response = await client.post(
            "/api/v1/restaurants",
            json={
                "nombre": "Test",
                "direccion": "Test",
                "categoria": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        restaurante_id = create_response.json()["id"]

        # Deactivate
        response = await client.post(
            f"/api/v1/restaurants/{restaurante_id}/deactivate",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False
