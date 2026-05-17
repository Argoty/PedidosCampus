import pytest
from uuid import uuid4
from decimal import Decimal

pytestmark = pytest.mark.asyncio


class TestProductos:
    """Tests for Product endpoints."""

    @pytest.fixture
    async def restaurante(self, client, admin_token):
        """Create a test restaurante."""
        response = await client.post(
            "/restaurants",
            json={
                "nombre": "Test Restaurant",
                "direccion": "Cra 1 # 1",
                "categoria": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        return response.json()

    async def test_create_producto(self, client, admin_token, restaurante):
        """Test creating a producto."""
        response = await client.post(
            f"/restaurants/{restaurante['id']}/products",
            json={
                "nombre": "Pizza Margarita",
                "descripcion": "Clásica con queso",
                "precio": "25.50",
                "disponible": True,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["nombre"] == "Pizza Margarita"
        assert float(data["precio"]) == 25.50
        assert data["disponible"] is True

    async def test_create_producto_invalid_precio(
        self, client, admin_token, restaurante
    ):
        """Test validation of precio field."""
        response = await client.post(
            f"/restaurants/{restaurante['id']}/products",
            json={
                "nombre": "Test",
                "precio": "-10.00",  # Invalid: negative
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 422

    async def test_create_producto_restaurante_not_found(self, client, admin_token):
        """Test creating producto for non-existent restaurante."""
        response = await client.post(
            f"/restaurants/{uuid4()}/products",
            json={
                "nombre": "Test",
                "precio": "10.00",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 404

    async def test_list_productos(self, client, admin_token, restaurante):
        """Test listing productos."""
        # Create some productos
        await client.post(
            f"/restaurants/{restaurante['id']}/products",
            json={"nombre": "Producto 1", "precio": "10.00"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        await client.post(
            f"/restaurants/{restaurante['id']}/products",
            json={"nombre": "Producto 2", "precio": "20.00"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # List
        response = await client.get(f"/restaurants/{restaurante['id']}/products")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= 2

    async def test_list_productos_filter_disponible(
        self, client, admin_token, restaurante
    ):
        """Test filtering productos by disponible."""
        # Create productos
        create_response = await client.post(
            f"/restaurants/{restaurante['id']}/products",
            json={"nombre": "Available", "precio": "10.00", "disponible": True},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        producto_id = create_response.json()["id"]

        await client.post(
            f"/restaurants/{restaurante['id']}/products",
            json={"nombre": "Unavailable", "precio": "20.00", "disponible": False},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # Filter available only
        response = await client.get(
            f"/restaurants/{restaurante['id']}/products?disponible=true"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1

    async def test_get_producto_by_id(self, client, admin_token, restaurante):
        """Test getting producto by ID."""
        create_response = await client.post(
            f"/restaurants/{restaurante['id']}/products",
            json={"nombre": "Test Producto", "precio": "15.50"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        producto_id = create_response.json()["id"]

        response = await client.get(f"/restaurants/products/{producto_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == producto_id
        assert data["nombre"] == "Test Producto"

    async def test_get_producto_not_found(self, client):
        """Test getting non-existent producto."""
        response = await client.get(f"/restaurants/products/{uuid4()}")
        assert response.status_code == 404

    async def test_update_producto(self, client, admin_token, restaurante):
        """Test updating producto."""
        create_response = await client.post(
            f"/restaurants/{restaurante['id']}/products",
            json={"nombre": "Original", "precio": "10.00"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        producto_id = create_response.json()["id"]

        response = await client.patch(
            f"/restaurants/products/{producto_id}",
            json={"nombre": "Updated", "precio": "12.50"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["nombre"] == "Updated"
        assert float(data["precio"]) == 12.50

    async def test_delete_producto_soft_delete(self, client, admin_token, restaurante):
        """Test soft delete (sets disponible=false)."""
        create_response = await client.post(
            f"/restaurants/{restaurante['id']}/products",
            json={"nombre": "To Delete", "precio": "10.00"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        producto_id = create_response.json()["id"]

        response = await client.delete(
            f"/restaurants/products/{producto_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 204

        # Verify soft delete
        get_response = await client.get(f"/restaurants/products/{producto_id}")
        assert get_response.json()["disponible"] is False

    async def test_delete_producto_not_found(self, client, admin_token):
        """Test deleting non-existent producto."""
        response = await client.delete(
            f"/restaurants/products/{uuid4()}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 404


class TestProductoValidacionBatch:
    """Tests for batch product validation."""

    @pytest.fixture
    async def setup_productos(self, client, admin_token):
        """Create test restaurante with productos."""
        # Create restaurante
        rest_response = await client.post(
            "/restaurants",
            json={
                "nombre": "Batch Test Restaurant",
                "direccion": "Cra 1 # 1",
                "categoria": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        restaurante_id = rest_response.json()["id"]

        # Create productos
        p1 = await client.post(
            f"/restaurants/{restaurante_id}/products",
            json={"nombre": "Producto 1", "precio": "10.00", "disponible": True},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        p1_id = p1.json()["id"]

        p2 = await client.post(
            f"/restaurants/{restaurante_id}/products",
            json={"nombre": "Producto 2", "precio": "20.00", "disponible": False},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        p2_id = p2.json()["id"]

        return {
            "p1_id": p1_id,
            "p2_id": p2_id,
            "restaurante_id": restaurante_id,
        }

    async def test_validate_batch_all_ok(self, client, setup_productos):
        """Test batch validation with all items valid."""
        response = await client.post(
            "/restaurants/products/validate-batch",
            json={
                "items": [
                    {
                        "producto_id": str(setup_productos["p1_id"]),
                        "precio_unit": "10.00",
                    },
                ]
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["ok"] is True
        assert data["items"][0]["nombre"] == "Producto 1"

    async def test_validate_batch_price_mismatch(self, client, setup_productos):
        """Test batch validation with price mismatch."""
        response = await client.post(
            "/restaurants/products/validate-batch",
            json={
                "items": [
                    {
                        "producto_id": str(setup_productos["p1_id"]),
                        "precio_unit": "15.00",
                    },
                ]
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["items"][0]["ok"] is False
        assert "Precio no coincide" in data["items"][0]["error"]

    async def test_validate_batch_unavailable(self, client, setup_productos):
        """Test batch validation with unavailable product."""
        response = await client.post(
            "/restaurants/products/validate-batch",
            json={
                "items": [
                    {
                        "producto_id": str(setup_productos["p2_id"]),
                        "precio_unit": "20.00",
                    },
                ]
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["items"][0]["ok"] is False
        assert "no disponible" in data["items"][0]["error"]

    async def test_validate_batch_not_found(self, client):
        """Test batch validation with non-existent product."""
        fake_id = uuid4()
        response = await client.post(
            "/restaurants/products/validate-batch",
            json={
                "items": [
                    {"producto_id": str(fake_id), "precio_unit": "10.00"},
                ]
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["items"][0]["ok"] is False
        assert "no encontrado" in data["items"][0]["error"]

    async def test_validate_batch_multiple_items(self, client, setup_productos):
        """Test batch validation with multiple items."""
        response = await client.post(
            "/restaurants/products/validate-batch",
            json={
                "items": [
                    {
                        "producto_id": str(setup_productos["p1_id"]),
                        "precio_unit": "10.00",
                    },
                    {
                        "producto_id": str(setup_productos["p2_id"]),
                        "precio_unit": "20.00",
                    },
                    {"producto_id": str(uuid4()), "precio_unit": "5.00"},
                ]
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 3
        assert data["items"][0]["ok"] is True
        assert data["items"][1]["ok"] is False
        assert data["items"][2]["ok"] is False

    async def test_validate_batch_accepts_legacy_array_body(
        self, client, setup_productos
    ):
        """Test backward compatibility with legacy array body and camelCase fields."""
        response = await client.post(
            "/restaurants/products/validate-batch",
            json=[
                {
                    "productId": str(setup_productos["p1_id"]),
                    "precioUnit": "10.00",
                }
            ],
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["ok"] is True
