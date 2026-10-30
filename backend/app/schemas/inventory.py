"""Pydantic schemas for simulated inventory management and Chief Pharmacist oversight."""
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator, model_validator


class InventoryAdjustmentRequest(BaseModel):
    """Legacy/direct adjustment schema by inventory_item_id."""
    inventory_item_id: str = Field(..., description="Target inventory item UUID")
    quantity_delta: int = Field(..., description="Adjustment delta (positive to restock, negative to reduce)")
    reason: str = Field(..., min_length=3, max_length=255, description="Audited justification for adjustment")

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        trimmed = v.strip() if v else ""
        if len(trimmed) < 3:
            raise ValueError("Adjustment reason must contain at least 3 non-whitespace characters.")
        return trimmed


class InventoryTransactionRequest(BaseModel):
    """Unified inventory transaction request schema for RESTOCK and ADJUSTMENT."""
    medication_id: Optional[str] = Field(default=None, description="Target medication ID (e.g. 'MED-LIS-10')")
    inventory_item_id: Optional[str] = Field(default=None, description="Target inventory item UUID")
    transaction_type: Literal["RESTOCK", "ADJUSTMENT"] = Field(
        ..., description="Transaction type: RESTOCK (receipt of stock) or ADJUSTMENT (count discrepancy, damage, waste)"
    )
    quantity: int = Field(..., gt=0, description="Positive quantity of units to receive or adjust")
    direction: Optional[Literal["INCREASE", "DECREASE"]] = Field(
        default=None,
        description="For ADJUSTMENT: INCREASE (found extra stock) or DECREASE (waste, shrinkage). Defaults to DECREASE for ADJUSTMENT, INCREASE for RESTOCK.",
    )
    reason: Optional[str] = Field(
        default=None,
        description="Mandatory audited clinical explanation for ADJUSTMENT; optional for RESTOCK.",
    )

    @model_validator(mode="after")
    def validate_transaction(self):
        if not self.medication_id and not self.inventory_item_id:
            raise ValueError("Either 'medication_id' or 'inventory_item_id' must be provided.")
        if self.transaction_type == "ADJUSTMENT":
            trimmed_reason = self.reason.strip() if self.reason else ""
            if len(trimmed_reason) < 3:
                raise ValueError("A non-empty reason of at least 3 characters is mandatory for inventory adjustments.")
        return self


class InventoryTransactionDetail(BaseModel):
    """Detailed view of an individual inventory transaction."""
    id: str
    inventory_item_id: str
    transaction_type: str
    quantity_delta: int
    quantity_after: int
    reason: str
    actor_id: Optional[str] = None
    actor_username: Optional[str] = None
    created_at: datetime


class InventoryTransactionResponse(BaseModel):
    """Response returned upon successfully recording an inventory transaction."""
    status: str
    transaction_id: str
    inventory_item_id: str
    medication_id: str
    transaction_type: str
    quantity_delta: int
    quantity_before: int
    quantity_after: int
    reason: str
    created_at: datetime
    actor_username: str
    disclaimer: str = (
        "Simulated central pharmacy inventory transaction. "
        "Advisory educational prototype only; not for real-world medication dispensing."
    )


class InventoryItemResponse(BaseModel):
    """Summary representation of a tracked inventory item."""
    id: str
    medication_id: str
    generic_name: str
    brand_name: str
    drug_class: str
    dosage_form: str
    standard_strength: str
    location: str
    quantity_on_hand: int
    reorder_threshold: int
    stock_status: Literal["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]
    is_low_stock: bool
    lot_number: str
    expiration_date: date
    unit_cost_cents: int
    last_updated: datetime


class InventoryItemDetailResponse(InventoryItemResponse):
    """Detailed representation of an inventory item including transaction history."""
    transactions: list[InventoryTransactionDetail] = Field(default_factory=list)


class InventorySummaryResponse(BaseModel):
    """Aggregate summary of central pharmacy inventory metrics."""
    total_items: int
    total_units_on_hand: int
    low_stock_count: int
    out_of_stock_count: int
    adequate_stock_count: int
    total_inventory_value_cents: int
    disclaimer: str = (
        "Demonstration hospital inventory summary. "
        "Advisory educational prototype only; not clinically validated."
    )


class InventoryExceptionItem(BaseModel):
    """Item-level exception record for out-of-stock or low-stock items."""
    inventory_item_id: str
    medication_id: str
    generic_name: str
    brand_name: str
    location: str
    quantity_on_hand: int
    reorder_threshold: int
    deficit: int
    stock_status: str
    severity: str  # HIGH (out of stock), MODERATE (low stock)


class ChiefOversightDashboardResponse(BaseModel):
    """Comprehensive executive dashboard for Chief Pharmacist oversight."""
    inventory_summary: InventorySummaryResponse
    inventory_exceptions: list[InventoryExceptionItem]
    workflow_counts: dict[str, int]
    pending_escalations_count: int
    total_overrides_count: int
    recent_audit_events: list[dict]
    disclaimer: str = (
        "Chief Pharmacist oversight executive dashboard. "
        "Advisory educational prototype only; not for clinical dispensing."
    )
