from datetime import datetime, date, timezone
import uuid
from sqlalchemy import String, Integer, DateTime, Date, ForeignKey, event
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    medication_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("medication_references.id", ondelete="RESTRICT"), unique=True, nullable=False, index=True
    )
    location: Mapped[str] = mapped_column(String(100), default="Central Pharmacy Carousel A", nullable=False)
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reorder_threshold: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    unit_cost_cents: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    lot_number: Mapped[str] = mapped_column(String(50), nullable=False)
    expiration_date: Mapped[date] = mapped_column(Date, nullable=False)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    medication: Mapped["MedicationReference"] = relationship("MedicationReference", back_populates="inventory_item")
    transactions: Mapped[list["InventoryTransaction"]] = relationship(
        "InventoryTransaction", back_populates="inventory_item", cascade="all, delete-orphan"
    )

    @property
    def is_low_stock(self) -> bool:
        return self.quantity_on_hand <= self.reorder_threshold


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    inventory_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    actor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)  # ADJUSTMENT, ALLOCATION, RESTOCK
    quantity_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    inventory_item: Mapped["InventoryItem"] = relationship("InventoryItem", back_populates="transactions")
    actor: Mapped["User"] = relationship("User", back_populates="inventory_transactions")


# Enforce append-only immutability of inventory transactions at the ORM level
@event.listens_for(InventoryTransaction, "before_update")
def prevent_inventory_transaction_update(mapper, connection, target):
    raise PermissionError("Inventory transactions are immutable historical audit records and cannot be updated.")


@event.listens_for(InventoryTransaction, "before_delete")
def prevent_inventory_transaction_delete(mapper, connection, target):
    raise PermissionError("Inventory transactions are immutable historical audit records and cannot be deleted.")
