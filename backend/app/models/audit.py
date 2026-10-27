from datetime import datetime, timezone
import uuid
from sqlalchemy import String, DateTime, ForeignKey, Text, event
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class AuditEvent(Base):
    """
    Append-only audit event log implemented with application-level and ORM controls.
    Records authentication events, review decisions, overrides, escalations,
    resolutions, and inventory adjustments.
    
    Immutability is enforced at the ORM layer by rejecting update and delete operations.
    """
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    actor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    actor_username: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    actor_role: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    details: Mapped[str] = mapped_column(Text, nullable=False)  # JSON-encoded payload
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    actor: Mapped["User | None"] = relationship("User")


# Enforce append-only immutability at the ORM level
@event.listens_for(AuditEvent, "before_update")
def prevent_audit_event_update(mapper, connection, target):
    raise PermissionError("Audit events are immutable and cannot be updated.")


@event.listens_for(AuditEvent, "before_delete")
def prevent_audit_event_delete(mapper, connection, target):
    raise PermissionError("Audit events are append-only and cannot be deleted.")
