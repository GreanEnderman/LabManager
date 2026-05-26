from typing import List

class DatabaseCleaner:
    def __init__(self, db_connection):
        self.db = db_connection

    async def reset_tables(self, tables: List[str]):
        for table in tables:
            await self.db.execute(f"TRUNCATE TABLE {table} CASCADE")

    async def reset_all(self):
        tables = await self._get_all_tables()
        await self.reset_tables(tables)

    async def _get_all_tables(self) -> List[str]:
        query = """
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
        """
        result = await self.db.fetch(query)
        return [row['tablename'] for row in result]
