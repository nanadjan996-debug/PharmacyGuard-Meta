"""Pydantic schemas for simulated inventory management."""
from pydantic import BaseModel, Field


class InventoryAdjustmentRequest(BaseModel):
    inventory_item_id: str = Field(..., description="Target inventory item UUID")
    quantity_delta: int = Field(..., description="Adjustment delta (positive to restock, negative to reduce)")
    reason: str = Field(..., min_length=3, max_length=255, description="Audited justification for adjustment")


class InventoryItemResponse(BaseModel):
    id: str
    medication_id: str
    generic_name: str
    location: str
    quantity_on_hand: int
    reorder_threshold: int
    is_low_stock: bool
    lot_number: str
