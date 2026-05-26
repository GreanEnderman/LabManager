import csv
from io import StringIO
from typing import AsyncIterator


async def stream_csv_records(file_content: bytes, chunk_size: int = 1000) -> AsyncIterator[list[dict]]:
    content = file_content.decode("utf-8")
    reader = csv.DictReader(StringIO(content))

    chunk = []
    for row in reader:
        chunk.append(row)
        if len(chunk) >= chunk_size:
            yield chunk
            chunk = []

    if chunk:
        yield chunk


class BatchProcessor:
    def __init__(self, batch_id: str, operator: str, file_name: str):
        self.batch_id = batch_id
        self.operator = operator
        self.file_name = file_name
        self.total_count = 0
        self.success_count = 0
        self.failed_count = 0
        self.errors = []

    async def process_chunk(self, records: list[dict], start_index: int) -> None:
        for i, record in enumerate(records):
            record_index = start_index + i
            self.total_count += 1
            self.success_count += 1

    def get_status(self) -> dict:
        return {
            "batch_id": self.batch_id,
            "total_count": self.total_count,
            "success_count": self.success_count,
            "failed_count": self.failed_count,
            "status": "completed" if self.total_count > 0 else "pending",
        }
