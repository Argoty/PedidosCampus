from fastapi import APIRouter

from app.api.v1.endpoints import restaurants, products

api_router = APIRouter(prefix="/restaurants")

api_router.include_router(restaurants.router)
api_router.include_router(products.router)
