"""Seed script for inventory data (chemicals and equipment).

This script populates the chemicals and equipment tables with initial mock data
from the inventory.py file.

Usage:
    python -m app.db.seed_inventory
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.core.config import get_settings
from app.db.postgres import get_db_connection


# Mock data from inventory.py
CHEMICALS = [
    {
        "id": "chem-001",
        "name": "盐酸",
        "cas_number": "7647-01-0",
        "category": "无机酸",
        "spec": "分析纯",
        "current_quantity": 3,
        "threshold": 5,
        "unit": "瓶",
        "status": "低库存",
        "lab_name": "化学实验室A",
        "owner_name": "张三",
        "remark": "需要补货",
    },
    {
        "id": "chem-002",
        "name": "硫酸",
        "cas_number": "7664-93-9",
        "category": "无机酸",
        "spec": "分析纯",
        "current_quantity": 8,
        "threshold": 5,
        "unit": "瓶",
        "status": "正常",
        "lab_name": "化学实验室A",
        "owner_name": "张三",
        "remark": None,
    },
    {
        "id": "chem-003",
        "name": "氢氧化钠",
        "cas_number": "1310-73-2",
        "category": "无机碱",
        "spec": "分析纯",
        "current_quantity": 12,
        "threshold": 5,
        "unit": "瓶",
        "status": "正常",
        "lab_name": "化学实验室B",
        "owner_name": "李四",
        "remark": None,
    },
]

EQUIPMENT = [
    {
        "id": "equip-001",
        "name": "高效液相色谱仪",
        "vendor": "安捷伦",
        "model": "1260 Infinity II",
        "status": "正常",
        "lab_name": "分析实验室",
        "owner_name": "王五",
        "last_maintenance_at": "2026-03-15",
        "remark": None,
    },
    {
        "id": "equip-002",
        "name": "气相色谱仪",
        "vendor": "岛津",
        "model": "GC-2030",
        "status": "正常",
        "lab_name": "分析实验室",
        "owner_name": "王五",
        "last_maintenance_at": "2026-04-01",
        "remark": None,
    },
    {
        "id": "equip-003",
        "name": "紫外分光光度计",
        "vendor": "赛默飞",
        "model": "Evolution 220",
        "status": "待维护",
        "lab_name": "化学实验室A",
        "owner_name": "张三",
        "last_maintenance_at": "2025-10-20",
        "remark": "超过6个月未维护",
    },
]


async def seed_chemicals(conn):
    """Seed chemicals table."""
    print("Seeding chemicals...")

    for chem in CHEMICALS:
        # Check if already exists
        result = await conn.execute(
            "SELECT id FROM chemicals WHERE id = %s",
            (chem["id"],)
        )
        existing = await result.fetchone()

        if existing:
            print(f"  - Chemical {chem['id']} already exists, skipping")
            continue

        await conn.execute(
            """
            INSERT INTO chemicals (
                id, name, cas_number, category, spec,
                current_quantity, threshold, unit, status,
                lab_name, owner_name, remark, metadata
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, '{}'::jsonb
            )
            """,
            (
                chem["id"],
                chem["name"],
                chem["cas_number"],
                chem["category"],
                chem["spec"],
                chem["current_quantity"],
                chem["threshold"],
                chem["unit"],
                chem["status"],
                chem["lab_name"],
                chem["owner_name"],
                chem["remark"],
            )
        )
        print(f"  OK Inserted chemical: {chem['name']} ({chem['id']})")

    print(f"Chemicals seeding complete. Total: {len(CHEMICALS)}")


async def seed_equipment(conn):
    """Seed equipment table."""
    print("\nSeeding equipment...")

    for equip in EQUIPMENT:
        # Check if already exists
        result = await conn.execute(
            "SELECT id FROM equipment WHERE id = %s",
            (equip["id"],)
        )
        existing = await result.fetchone()

        if existing:
            print(f"  - Equipment {equip['id']} already exists, skipping")
            continue

        await conn.execute(
            """
            INSERT INTO equipment (
                id, name, vendor, model, status,
                lab_name, owner_name, last_maintenance_at, remark, metadata
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, '{}'::jsonb
            )
            """,
            (
                equip["id"],
                equip["name"],
                equip["vendor"],
                equip["model"],
                equip["status"],
                equip["lab_name"],
                equip["owner_name"],
                equip["last_maintenance_at"],
                equip["remark"],
            )
        )
        print(f"  OK Inserted equipment: {equip['name']} ({equip['id']})")

    print(f"Equipment seeding complete. Total: {len(EQUIPMENT)}")


async def main():
    """Main seed function."""
    settings = get_settings()

    if not settings.database_url:
        print("ERROR: DATABASE_URL not configured in environment")
        print("Please set DATABASE_URL in your .env file")
        sys.exit(1)

    print(f"Connecting to database: {settings.database_url[:30]}...")

    try:
        async with get_db_connection() as conn:
            print("Connected successfully!\n")

            # Seed chemicals
            await seed_chemicals(conn)

            # Seed equipment
            await seed_equipment(conn)

            print("\nOK All seed data inserted successfully!")

    except Exception as e:
        print(f"\nX Error seeding database: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
