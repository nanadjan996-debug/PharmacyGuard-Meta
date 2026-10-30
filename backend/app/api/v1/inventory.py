"""Inventory management APIs: listing, summary, detail, and atomic stock transactions."""
from datetime import datetime, timezone
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db, require_any_pharmacist, get_current_user
from app.models.user import User
from app.models.inventory import InventoryItem, InventoryTransaction
from app.models.reference import MedicationReference
from app.models.audit import AuditEvent
from app.schemas.inventory import (
    InventoryItemResponse,
    InventoryItemDetailResponse,
    InventoryTransactionRequest,
    InventoryTransactionResponse,
    InventoryTransactionDetail,
    InventorySummaryResponse,
)

router = APIRouter(prefix="/inventory", tags=["Inventory Management"])


def _compute_stock_status(quantity: int, threshold: int) -> str:
    """Helper to determine categorical stock status."""
    if quantity == 0:
        return "OUT_OF_STOCK"
    elif quantity <= threshold:
        return "LOW_STOCK"
    return "IN_STOCK"


@router.get("", response_model=list[InventoryItemResponse])
def list_inventory(
    skip: int = Query(0, ge=0, description="Pagination skip offset"),
    limit: int = Query(50, ge=1, le=100, description="Pagination limit"),
    status: Optional[str] = Query(None, description="Filter by stock status: 'low_stock', 'out_of_stock', or 'in_stock'"),
    low_stock: Optional[bool] = Query(None, description="Filter for items at or below reorder threshold"),
    out_of_stock: Optional[bool] = Query(None, description="Filter for items with zero quantity on hand"),
    search: Optional[str] = Query(None, description="Search term matching generic name, brand name, or medication ID"),
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> list[InventoryItemResponse]:
    """
    Retrieve paginated, consistently ordered inventory records with medication details and stock status.
    Protected: Accessible to Staff Pharmacists and Chief Pharmacists. Students receive 403 Forbidden.
    """
    query = (
        db.query(InventoryItem)
        .join(MedicationReference, InventoryItem.medication_id == MedicationReference.id)
    )

    # 1. Search filter
    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.filter(
            func.lower(MedicationReference.generic_name).like(search_term)
            | func.lower(MedicationReference.brand_name).like(search_term)
            | func.lower(InventoryItem.medication_id).like(search_term)
        )

    # 2. Stock status filters
    if out_of_stock is True or (status and status.lower() == "out_of_stock"):
        query = query.filter(InventoryItem.quantity_on_hand == 0)
    elif low_stock is True or (status and status.lower() == "low_stock"):
        query = query.filter(
            InventoryItem.quantity_on_hand <= InventoryItem.reorder_threshold,
            InventoryItem.quantity_on_hand > 0,
        )
    elif status and status.lower() == "in_stock":
        query = query.filter(InventoryItem.quantity_on_hand > InventoryItem.reorder_threshold)

    # 3. Consistent deterministic ordering by generic name, then medication ID
    items = (
        query.order_by(MedicationReference.generic_name.asc(), InventoryItem.medication_id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for item in items:
        med = item.medication
        results.append(
            InventoryItemResponse(
                id=item.id,
                medication_id=item.medication_id,
                generic_name=med.generic_name,
                brand_name=med.brand_name,
                drug_class=med.drug_class,
                dosage_form=med.dosage_form,
                standard_strength=med.standard_strength,
                location=item.location,
                quantity_on_hand=item.quantity_on_hand,
                reorder_threshold=item.reorder_threshold,
                stock_status=_compute_stock_status(item.quantity_on_hand, item.reorder_threshold),
                is_low_stock=item.is_low_stock,
                lot_number=item.lot_number,
                expiration_date=item.expiration_date,
                unit_cost_cents=item.unit_cost_cents,
                last_updated=item.last_updated,
            )
        )
    return results


@router.get("/summary", response_model=InventorySummaryResponse)
def get_inventory_summary(
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> InventorySummaryResponse:
    """
    Retrieve aggregate metrics across all tracked central pharmacy inventory items.
    Protected: Staff Pharmacists and Chief Pharmacists. Students receive 403 Forbidden.
    """
    items = db.query(InventoryItem).all()
    total_items = len(items)
    total_units = sum(i.quantity_on_hand for i in items)
    out_of_stock = sum(1 for i in items if i.quantity_on_hand == 0)
    low_stock = sum(1 for i in items if 0 < i.quantity_on_hand <= i.reorder_threshold)
    adequate_stock = sum(1 for i in items if i.quantity_on_hand > i.reorder_threshold)
    total_value_cents = sum(i.quantity_on_hand * i.unit_cost_cents for i in items)

    return InventorySummaryResponse(
        total_items=total_items,
        total_units_on_hand=total_units,
        low_stock_count=low_stock,
        out_of_stock_count=out_of_stock,
        adequate_stock_count=adequate_stock,
        total_inventory_value_cents=total_value_cents,
    )


@router.get("/{medication_id}", response_model=InventoryItemDetailResponse)
def get_inventory_item_detail(
    medication_id: str,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> InventoryItemDetailResponse:
    """
    Retrieve complete inventory record and transaction history for a specific medication.
    Accepts medication_id (e.g. 'MED-CEF-300') or inventory item UUID.
    Protected: Staff Pharmacists and Chief Pharmacists.
    """
    item = (
        db.query(InventoryItem)
        .filter(
            (InventoryItem.medication_id == medication_id) | (InventoryItem.id == medication_id)
        )
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory record for medication '{medication_id}' not found.",
        )

    med = item.medication
    transactions_detail = []
    # Sort transactions chronologically descending (newest first)
    for txn in sorted(item.transactions, key=lambda t: t.created_at, reverse=True):
        transactions_detail.append(
            InventoryTransactionDetail(
                id=txn.id,
                inventory_item_id=txn.inventory_item_id,
                transaction_type=txn.transaction_type,
                quantity_delta=txn.quantity_delta,
                quantity_after=txn.quantity_after,
                reason=txn.reason,
                actor_id=txn.actor_id,
                actor_username=txn.actor.username if txn.actor else None,
                created_at=txn.created_at,
            )
        )

    return InventoryItemDetailResponse(
        id=item.id,
        medication_id=item.medication_id,
        generic_name=med.generic_name,
        brand_name=med.brand_name,
        drug_class=med.drug_class,
        dosage_form=med.dosage_form,
        standard_strength=med.standard_strength,
        location=item.location,
        quantity_on_hand=item.quantity_on_hand,
        reorder_threshold=item.reorder_threshold,
        stock_status=_compute_stock_status(item.quantity_on_hand, item.reorder_threshold),
        is_low_stock=item.is_low_stock,
        lot_number=item.lot_number,
        expiration_date=item.expiration_date,
        unit_cost_cents=item.unit_cost_cents,
        last_updated=item.last_updated,
        transactions=transactions_detail,
    )


@router.post("/transactions", response_model=InventoryTransactionResponse)
def record_inventory_transaction(
    request_data: InventoryTransactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InventoryTransactionResponse:
    """
    Record an atomic inventory transaction (RESTOCK or ADJUSTMENT) with audit trail.
    
    Authorization Policy & Operational Invariants:
    1. Role Restrictions:
       - Pharmacy Students: Forbidden (403 Forbidden) from all inventory transactions.
       - Staff Pharmacists: Authorized to record stock receipts (RESTOCK). Discrepancy
         adjustments (ADJUSTMENT) are restricted to Chief Pharmacists (403 Forbidden).
       - Chief Pharmacists: Authorized for all transaction types (RESTOCK and ADJUSTMENT).
    2. Input Validation:
       - Quantity must be strictly positive (> 0).
       - Transaction type must be 'RESTOCK' or 'ADJUSTMENT'.
       - ADJUSTMENT requires a non-empty audited reason (>= 3 chars).
    3. Negative Stock Prevention:
       - Attempted adjustments that would drive quantity_on_hand < 0 are rejected with HTTP 422.
    4. Transactional Atomicity & Immutability:
       - The stock balance update, InventoryTransaction record, and AuditEvent commit together
         or roll back completely on failure.
       - Historical inventory transactions cannot be updated or deleted.
    """
    user_roles = {ur.role_id for ur in current_user.roles}

    # 1. Reject Pharmacy Students
    if "pharmacy_student" in user_roles and not any(r in user_roles for r in ("staff_pharmacist", "chief_pharmacist")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Pharmacy students cannot record inventory transactions.",
        )

    # 2. Enforce narrowest safe permission for ADJUSTMENT
    if request_data.transaction_type == "ADJUSTMENT" and "chief_pharmacist" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Inventory discrepancy adjustments require Chief Pharmacist authorization. Staff pharmacists may only record RESTOCK shipments.",
        )

    # 3. Ensure actor has at least one authorized pharmacist role
    if not any(r in user_roles for r in ("staff_pharmacist", "chief_pharmacist")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: An authorized pharmacist role is required to mutate inventory.",
        )

    # 4. Lookup target inventory item
    query = db.query(InventoryItem)
    if request_data.inventory_item_id:
        item = query.filter_by(id=request_data.inventory_item_id).first()
    else:
        item = query.filter_by(medication_id=request_data.medication_id).first()

    if not item:
        target_id = request_data.inventory_item_id or request_data.medication_id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item '{target_id}' not found.",
        )

    # 5. Compute quantity delta and validate negative stock prevention
    quantity_before = item.quantity_on_hand
    if request_data.transaction_type == "RESTOCK":
        quantity_delta = request_data.quantity
        reason = request_data.reason.strip() if request_data.reason else "Routine stock receipt from distributor"
    else:  # ADJUSTMENT
        # Validate reason
        if not request_data.reason or len(request_data.reason.strip()) < 3:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A non-empty clinical justification of at least 3 characters is mandatory for inventory adjustments.",
            )
        reason = request_data.reason.strip()
        direction = request_data.direction or "DECREASE"
        quantity_delta = request_data.quantity if direction == "INCREASE" else -request_data.quantity

    quantity_after = quantity_before + quantity_delta
    if quantity_after < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Transaction rejected: adjustment delta {quantity_delta} would result in invalid "
                f"negative inventory ({quantity_after}). Current quantity on hand is {quantity_before}."
            ),
        )

    now = datetime.now(timezone.utc)
    try:
        # 6. Apply stock level update
        item.quantity_on_hand = quantity_after
        item.last_updated = now

        # 7. Create immutable inventory transaction record
        txn = InventoryTransaction(
            inventory_item_id=item.id,
            actor_id=current_user.id,
            transaction_type=request_data.transaction_type,
            quantity_delta=quantity_delta,
            quantity_after=quantity_after,
            reason=reason,
            created_at=now,
        )
        db.add(txn)
        db.flush()  # populate txn.id

        # 8. Record append-only audit event
        audit_event = AuditEvent(
            actor_id=current_user.id,
            actor_username=current_user.username,
            actor_role=",".join(sorted(user_roles)),
            action=f"INVENTORY_{request_data.transaction_type}",
            entity_type="InventoryItem",
            entity_id=item.id,
            details=json.dumps({
                "transaction_id": txn.id,
                "inventory_item_id": item.id,
                "medication_id": item.medication_id,
                "transaction_type": request_data.transaction_type,
                "quantity_before": quantity_before,
                "quantity_delta": quantity_delta,
                "quantity_after": quantity_after,
                "reason": reason,
            }),
        )
        db.add(audit_event)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database transaction failed during inventory mutation: {str(exc)}",
        )

    return InventoryTransactionResponse(
        status="success",
        transaction_id=txn.id,
        inventory_item_id=item.id,
        medication_id=item.medication_id,
        transaction_type=request_data.transaction_type,
        quantity_delta=quantity_delta,
        quantity_before=quantity_before,
        quantity_after=quantity_after,
        reason=reason,
        created_at=now,
        actor_username=current_user.username,
    )

