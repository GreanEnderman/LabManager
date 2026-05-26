from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class BatchHistory(Base):
    __tablename__ = "batch_history"

    batch_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    operator: Mapped[str] = mapped_column(String(255), nullable=False)
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False)


class ImportRecord(Base):
    __tablename__ = "import_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(String(64), nullable=False)
    operator: Mapped[str] = mapped_column(String(255), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=True)
    time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    run_id: Mapped[str] = mapped_column(String(64), nullable=False)


class ErrorRecord(Base):
    __tablename__ = "error_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(String(64), nullable=False)
    record_index: Mapped[int] = mapped_column(Integer, nullable=False)
    field_path: Mapped[str] = mapped_column(String(255), nullable=False)
    error_code: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
