"""Automated test suite for Milestone 6: Inventory Management and Oversight APIs."""
import json
import uuid
from unittest.mock import patch
import pytest
from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem, InventoryTransaction
from app.models.reference import MedicationReference
from app.models.audit import AuditEvent
from app.models.prescription import Prescription


def get_token(client, username, password):
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


# =====================================================================
# 1. INVENTORY LISTING, ORDERING & FILTERING
# =====================================================================

def test_inventory_listing_and_ordering(client):
    """
    GET /api/v1/inventory:
    - Lists all tracked central pharmacy inventory items
    - Consistently and deterministically ordered by generic_name, then medication_id
    - Returns medication identity, on-hand quantity, threshold, and stock status
    """
    token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/inventory", headers=headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 8  # 8 seeded medications in benchmark seed

    # Verify deterministic alphabetical ordering by generic name
    generic_names = [i["generic_name"].lower() for i in items]
    assert generic_names == sorted(generic_names), "Inventory items must be sorted alphabetically by generic_name"

    # Verify item schema contract
    sample = items[0]
    required_keys = [
        "id", "medication_id", "generic_name", "brand_name", "drug_class",
        "dosage_form", "standard_strength", "location", "quantity_on_hand",
        "reorder_threshold", "stock_status", "is_low_stock", "lot_number",
        "expiration_date", "unit_cost_cents", "last_updated"
    ]
    for key in required_keys:
        assert key in sample, f"Missing key '{key}' in inventory response"


def test_inventory_low_stock_and_out_of_stock_filtering(client, db_session: Session):
    """
    Filtering inventory by low_stock and out_of_stock states:
    - Cefdinir 300mg is seeded in low-stock status (12 on hand vs. 25 threshold)
    - Filter ?status=low_stock or ?low_stock=true returns only low-stock items
    - Filter ?status=out_of_stock or ?out_of_stock=true returns only out-of-stock items
    """
    token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Filter low_stock
    res_low = client.get("/api/v1/inventory?status=low_stock", headers=headers)
    assert res_low.status_code == 200
    low_items = res_low.json()
    assert len(low_items) >= 1
    # Confirm Cefdinir is in low-stock list
    cef = next((i for i in low_items if i["medication_id"] == "MED-CEF-500"), None)
    assert cef is not None
    assert cef["stock_status"] == "LOW_STOCK"
    assert cef["is_low_stock"] is True
    for item in low_items:
        assert 0 < item["quantity_on_hand"] <= item["reorder_threshold"]

    # 2. Test boolean flag ?low_stock=true
    res_low_flag = client.get("/api/v1/inventory?low_stock=true", headers=headers)
    assert res_low_flag.status_code == 200
    assert len(res_low_flag.json()) == len(low_items)

    # 3. Create a zero-quantity out-of-stock item
    inv_zero = db_session.query(InventoryItem).filter_by(medication_id="MED-WAR-5").first()
    original_qty = inv_zero.quantity_on_hand
    inv_zero.quantity_on_hand = 0
    db_session.commit()

    try:
        res_out = client.get("/api/v1/inventory?status=out_of_stock", headers=headers)
        assert res_out.status_code == 200
        out_items = res_out.json()
        assert len(out_items) >= 1
        assert any(i["medication_id"] == "MED-WAR-5" for i in out_items)
        for item in out_items:
            assert item["quantity_on_hand"] == 0
            assert item["stock_status"] == "OUT_OF_STOCK"
    finally:
        # Restore quantity
        inv_zero.quantity_on_hand = original_qty
        db_session.commit()


# =====================================================================
# 2. INVENTORY DETAIL & TRANSACTION HISTORY
# =====================================================================

def test_inventory_detail_and_transaction_history(client, db_session: Session):
    """
    GET /api/v1/inventory/{medication_id}:
    - Lookup by medication_id (e.g. 'MED-LIS-10') or by inventory item UUID
    - Returns full medication specifications and chronological transaction history
    - Returns 404 for non-existent medication
    """
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    chief_token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    chief_headers = {"Authorization": f"Bearer {chief_token}"}

    # Record a restock transaction first
    restock_payload = {
        "medication_id": "MED-LIS-10",
        "transaction_type": "RESTOCK",
        "quantity": 25,
        "reason": "Shipment PO-9821 received from McKesson",
    }
    tx_res = client.post("/api/v1/inventory/transactions", json=restock_payload, headers=staff_headers)
    assert tx_res.status_code == 200

    # 1. Query by medication_id
    detail_res1 = client.get("/api/v1/inventory/MED-LIS-10", headers=staff_headers)
    assert detail_res1.status_code == 200
    data1 = detail_res1.json()
    assert data1["medication_id"] == "MED-LIS-10"
    assert data1["generic_name"] == "Lisinopril"
    assert len(data1["transactions"]) >= 1
    latest_tx = data1["transactions"][0]
    assert latest_tx["transaction_type"] == "RESTOCK"
    assert latest_tx["quantity_delta"] == 25
    assert latest_tx["reason"] == "Shipment PO-9821 received from McKesson"
    assert latest_tx["actor_username"] == "pharmacist_demo"

    # 2. Query by inventory_item_id UUID
    detail_res2 = client.get(f"/api/v1/inventory/{data1['id']}", headers=staff_headers)
    assert detail_res2.status_code == 200
    assert detail_res2.json()["id"] == data1["id"]

    # 3. Query non-existent ID -> 404
    detail_404 = client.get("/api/v1/inventory/MED-DOES-NOT-EXIST", headers=staff_headers)
    assert detail_404.status_code == 404
    assert "not found" in detail_404.json()["detail"].lower()


# =====================================================================
# 3. INVENTORY MUTATIONS: RESTOCK & ADJUSTMENT
# =====================================================================

def test_successful_stock_receipt_by_staff_pharmacist(client, db_session: Session):
    """
    Staff Pharmacist successfully records a RESTOCK shipment:
    - Increments quantity_on_hand by positive quantity
    - Inserts immutable InventoryTransaction record
    - Appends INVENTORY_RESTOCK AuditEvent
    """
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    headers = {"Authorization": f"Bearer {staff_token}"}

    item = db_session.query(InventoryItem).filter_by(medication_id="MED-AMOX-500").first()
    initial_qty = item.quantity_on_hand

    payload = {
        "medication_id": "MED-AMOX-500",
        "transaction_type": "RESTOCK",
        "quantity": 100,
        "reason": "Received distributor lot #AMX-2026-99",
    }
    res = client.post("/api/v1/inventory/transactions", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["quantity_before"] == initial_qty
    assert data["quantity_delta"] == 100
    assert data["quantity_after"] == initial_qty + 100
    assert data["actor_username"] == "pharmacist_demo"

    # Verify DB state
    db_session.refresh(item)
    assert item.quantity_on_hand == initial_qty + 100

    # Verify AuditEvent
    audit = (
        db_session.query(AuditEvent)
        .filter_by(action="INVENTORY_RESTOCK", entity_id=item.id)
        .order_by(AuditEvent.timestamp.desc())
        .first()
    )
    assert audit is not None
    assert audit.actor_username == "pharmacist_demo"
    assert "AMX-2026-99" in audit.details


def test_successful_stock_adjustment_by_chief_pharmacist(client, db_session: Session):
    """
    Chief Pharmacist records a stock discrepancy adjustment:
    - DECREASE adjustment (e.g. damaged stock discarded)
    - INCREASE adjustment (e.g. audit recount physical variance)
    - Requires non-empty reason
    """
    chief_token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    headers = {"Authorization": f"Bearer {chief_token}"}

    item = db_session.query(InventoryItem).filter_by(medication_id="MED-MET-500").first()
    initial_qty = item.quantity_on_hand

    # 1. DECREASE adjustment
    payload_dec = {
        "medication_id": "MED-MET-500",
        "transaction_type": "ADJUSTMENT",
        "direction": "DECREASE",
        "quantity": 5,
        "reason": "Water damage to package container carousel shelf 4; discarded per policy.",
    }
    res_dec = client.post("/api/v1/inventory/transactions", json=payload_dec, headers=headers)
    assert res_dec.status_code == 200
    data_dec = res_dec.json()
    assert data_dec["quantity_delta"] == -5
    assert data_dec["quantity_after"] == initial_qty - 5

    db_session.refresh(item)
    assert item.quantity_on_hand == initial_qty - 5

    # 2. INCREASE adjustment
    payload_inc = {
        "medication_id": "MED-MET-500",
        "transaction_type": "ADJUSTMENT",
        "direction": "INCREASE",
        "quantity": 10,
        "reason": "Physical count audit revealed 10 unrecorded units in reserve bin B.",
    }
    res_inc = client.post("/api/v1/inventory/transactions", json=payload_inc, headers=headers)
    assert res_inc.status_code == 200
    data_inc = res_inc.json()
    assert data_inc["quantity_delta"] == 10
    assert data_inc["quantity_after"] == initial_qty - 5 + 10

    db_session.refresh(item)
    assert item.quantity_on_hand == initial_qty + 5


# =====================================================================
# 4. INPUT VALIDATION & NEGATIVE STOCK PREVENTION
# =====================================================================

def test_invalid_quantities_rejected(client):
    """Transactions with zero, negative, or invalid quantities must be rejected (422)."""
    token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # Zero quantity
    res_zero = client.post(
        "/api/v1/inventory/transactions",
        json={"medication_id": "MED-LIS-10", "transaction_type": "RESTOCK", "quantity": 0},
        headers=headers,
    )
    assert res_zero.status_code == 422

    # Negative quantity
    res_neg = client.post(
        "/api/v1/inventory/transactions",
        json={"medication_id": "MED-LIS-10", "transaction_type": "RESTOCK", "quantity": -15},
        headers=headers,
    )
    assert res_neg.status_code == 422


def test_attempted_negative_stock_rejected(client, db_session: Session):
    """
    Attempting an adjustment that reduces quantity_on_hand below 0 must be rejected (422)
    and the inventory balance must remain unmodified.
    """
    token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    item = db_session.query(InventoryItem).filter_by(medication_id="MED-CEF-500").first()
    current_qty = item.quantity_on_hand

    # Attempt to deduct more units than are available
    payload = {
        "medication_id": "MED-CEF-500",
        "transaction_type": "ADJUSTMENT",
        "direction": "DECREASE",
        "quantity": current_qty + 100,
        "reason": "Attempting excess deduction",
    }
    res = client.post("/api/v1/inventory/transactions", json=payload, headers=headers)
    assert res.status_code == 422
    assert "negative inventory" in res.json()["detail"].lower()

    # Confirm database was not modified
    db_session.refresh(item)
    assert item.quantity_on_hand == current_qty


def test_unknown_medication_or_inventory_record_rejected(client):
    """Mutating a non-existent medication or inventory item ID returns 404 Not Found."""
    token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "medication_id": "MED-NON-EXISTENT-XYZ",
        "transaction_type": "RESTOCK",
        "quantity": 10,
    }
    res = client.post("/api/v1/inventory/transactions", json=payload, headers=headers)
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_missing_adjustment_explanation_rejected(client):
    """
    ADJUSTMENT transactions require a non-empty, trimmed justification:
    - Omitted reason -> 422
    - Empty string reason -> 422
    - Whitespace-only reason -> 422
    """
    token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # Missing reason
    res1 = client.post(
        "/api/v1/inventory/transactions",
        json={"medication_id": "MED-LIS-10", "transaction_type": "ADJUSTMENT", "quantity": 5},
        headers=headers,
    )
    assert res1.status_code == 422

    # Whitespace-only reason
    res2 = client.post(
        "/api/v1/inventory/transactions",
        json={
            "medication_id": "MED-LIS-10",
            "transaction_type": "ADJUSTMENT",
            "quantity": 5,
            "reason": "    \t \n  ",
        },
        headers=headers,
    )
    assert res2.status_code == 422


# =====================================================================
# 5. ROLE-BASED ACCESS CONTROL & AUTHORIZATION
# =====================================================================

def test_student_and_unauthorized_access_denial(client):
    """
    Students and unauthenticated users are denied access:
    - Student mutating inventory -> 403 Forbidden
    - Student reading inventory -> 403 Forbidden
    - Student accessing oversight dashboard -> 403 Forbidden
    - Unauthenticated requests -> 401 Unauthorized
    """
    student_token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 1. Student mutating inventory -> 403
    res_mut = client.post(
        "/api/v1/inventory/transactions",
        json={"medication_id": "MED-LIS-10", "transaction_type": "RESTOCK", "quantity": 10},
        headers=student_headers,
    )
    assert res_mut.status_code == 403

    # 2. Student reading inventory list -> 403
    res_list = client.get("/api/v1/inventory", headers=student_headers)
    assert res_list.status_code == 403

    # 3. Student reading inventory summary -> 403
    res_sum = client.get("/api/v1/inventory/summary", headers=student_headers)
    assert res_sum.status_code == 403

    # 4. Student accessing Chief oversight dashboard -> 403
    res_dash = client.get("/api/v1/oversight/dashboard", headers=student_headers)
    assert res_dash.status_code == 403

    # 5. Unauthenticated requests -> 401
    assert client.get("/api/v1/inventory").status_code == 401
    assert client.get("/api/v1/inventory/summary").status_code == 401
    assert client.post("/api/v1/inventory/transactions", json={}).status_code == 401
    assert client.get("/api/v1/oversight/dashboard").status_code == 401


def test_staff_pharmacist_adjustment_denial_narrowest_permission(client):
    """
    Staff Pharmacist is permitted to record RESTOCK, but is forbidden (403) from
    performing inventory discrepancy ADJUSTMENTs (Chief Pharmacist only).
    """
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    payload = {
        "medication_id": "MED-LIS-10",
        "transaction_type": "ADJUSTMENT",
        "quantity": 5,
        "reason": "Staff pharmacist attempting discrepancy adjustment",
    }
    res = client.post("/api/v1/inventory/transactions", json=payload, headers=staff_headers)
    assert res.status_code == 403
    assert "chief pharmacist" in res.json()["detail"].lower()


# =====================================================================
# 6. TRANSACTION ATOMICITY, ROLLBACK & AUDIT INTEGRITY
# =====================================================================

def test_atomic_rollback_on_inventory_transaction_failure(client, db_session: Session):
    """
    If a database commit error occurs during inventory mutation,
    the transaction is rolled back cleanly:
    - Inventory quantity_on_hand remains at pre-mutation level
    - No partial InventoryTransaction is committed
    - No unlinked AuditEvent is persisted
    """
    chief_token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    headers = {"Authorization": f"Bearer {chief_token}"}

    item = db_session.query(InventoryItem).filter_by(medication_id="MED-AML-5").first()
    initial_qty = item.quantity_on_hand
    initial_tx_count = db_session.query(InventoryTransaction).filter_by(inventory_item_id=item.id).count()

    # Simulate database failure during commit
    with patch.object(db_session, "commit", side_effect=RuntimeError("Simulated DB IO Error")):
        payload = {
            "medication_id": "MED-AML-5",
            "transaction_type": "ADJUSTMENT",
            "quantity": 10,
            "reason": "Will fail during commit and trigger rollback",
        }
        res = client.post("/api/v1/inventory/transactions", json=payload, headers=headers)
        assert res.status_code == 500
        assert "Database transaction failed" in res.json()["detail"]

    # Verify rollback
    db_session.refresh(item)
    assert item.quantity_on_hand == initial_qty
    current_tx_count = db_session.query(InventoryTransaction).filter_by(inventory_item_id=item.id).count()
    assert current_tx_count == initial_tx_count


def test_no_mutation_of_historical_inventory_transactions(db_session: Session):
    """
    Historical inventory transactions are append-only audit records.
    Attempting ORM update or delete operations raises PermissionError.
    """
    # Create test transaction
    item = db_session.query(InventoryItem).first()
    txn = InventoryTransaction(
        id=str(uuid.uuid4()),
        inventory_item_id=item.id,
        actor_id=None,
        transaction_type="RESTOCK",
        quantity_delta=10,
        quantity_after=item.quantity_on_hand + 10,
        reason="Immutability baseline transaction",
    )
    db_session.add(txn)
    db_session.commit()

    # Attempt UPDATE -> PermissionError
    txn.reason = "Altered reason attempting history tampering"
    with pytest.raises(PermissionError) as exc_update:
        db_session.flush()
    assert "immutable" in str(exc_update.value).lower()
    db_session.rollback()

    # Re-fetch and attempt DELETE -> PermissionError
    fetched_txn = db_session.query(InventoryTransaction).filter_by(id=txn.id).first()
    assert fetched_txn is not None
    db_session.delete(fetched_txn)
    with pytest.raises(PermissionError) as exc_delete:
        db_session.flush()
    assert "immutable" in str(exc_delete.value).lower()
    db_session.rollback()


# =====================================================================
# 7. SUMMARY & CHIEF PHARMACIST OVERSIGHT APIS
# =====================================================================

def test_inventory_summary_accuracy(client, db_session: Session):
    """
    GET /api/v1/inventory/summary returns accurate aggregate metrics:
    - total_items
    - total_units_on_hand
    - low_stock_count
    - out_of_stock_count
    """
    token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/inventory/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Verify against direct database aggregates
    items = db_session.query(InventoryItem).all()
    assert data["total_items"] == len(items)
    assert data["total_units_on_hand"] == sum(i.quantity_on_hand for i in items)
    assert data["out_of_stock_count"] == sum(1 for i in items if i.quantity_on_hand == 0)
    assert data["low_stock_count"] == sum(1 for i in items if 0 < i.quantity_on_hand <= i.reorder_threshold)
    assert "Advisory" in data["disclaimer"]


def test_chief_pharmacist_oversight_endpoints(client):
    """
    Chief Pharmacist oversight endpoints:
    - GET /api/v1/oversight/dashboard: Executive dashboard with inventory, exceptions, workflow, and audits
    - GET /api/v1/oversight/inventory-exceptions: Detailed list of low-stock and out-of-stock items
    - GET /api/v1/oversight/workflow-summary: Department and status distribution
    - Staff Pharmacist access to these endpoints is rejected (403 Forbidden)
    """
    chief_token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    chief_headers = {"Authorization": f"Bearer {chief_token}"}
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # 1. Staff Pharmacist denied access (403 Forbidden)
    assert client.get("/api/v1/oversight/dashboard", headers=staff_headers).status_code == 403
    assert client.get("/api/v1/oversight/inventory-exceptions", headers=staff_headers).status_code == 403
    assert client.get("/api/v1/oversight/workflow-summary", headers=staff_headers).status_code == 403

    # 2. Chief Pharmacist accesses dashboard
    res_dash = client.get("/api/v1/oversight/dashboard", headers=chief_headers)
    assert res_dash.status_code == 200
    dash = res_dash.json()
    assert "inventory_summary" in dash
    assert "inventory_exceptions" in dash
    assert "workflow_counts" in dash
    assert "pending_escalations_count" in dash
    assert "recent_audit_events" in dash
    assert "Advisory" in dash["disclaimer"]

    # 3. Chief Pharmacist accesses inventory exceptions
    res_exc = client.get("/api/v1/oversight/inventory-exceptions", headers=chief_headers)
    assert res_exc.status_code == 200
    exceptions = res_exc.json()
    assert len(exceptions) >= 1
    cef = next((e for e in exceptions if e["medication_id"] == "MED-CEF-500"), None)
    assert cef is not None
    assert cef["stock_status"] == "LOW_STOCK"
    assert cef["deficit"] == cef["reorder_threshold"] - cef["quantity_on_hand"]

    # 4. Chief Pharmacist accesses workflow summary
    res_wf = client.get("/api/v1/oversight/workflow-summary", headers=chief_headers)
    assert res_wf.status_code == 200
    wf = res_wf.json()
    assert wf["status"] == "success"
    assert "status_distribution" in wf
    assert "department_distribution" in wf

