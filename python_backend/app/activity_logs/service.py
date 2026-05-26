"""Activity log service for querying and filtering task actions."""

from datetime import datetime
from typing import Optional

from psycopg import AsyncConnection

from app.tasks.models import TaskActionDTO
from app.tasks.repository import list_task_actions


class ActivityLogService:
    """Service for activity log operations."""

    def __init__(self, conn: AsyncConnection):
        """Initialize activity log service.

        Args:
            conn: Database connection
        """
        self.conn = conn

    async def list_task_actions(
        self,
        task_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> list[TaskActionDTO]:
        """List actions for a specific task with pagination.

        Args:
            task_id: Task ID to filter by
            limit: Maximum number of actions to return
            offset: Number of actions to skip

        Returns:
            List of task actions
        """
        # Use existing repository function
        actions = await list_task_actions(self.conn, task_id)

        # Apply pagination
        return actions[offset : offset + limit]

    async def list_actions_by_type(
        self,
        action_type: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[TaskActionDTO]:
        """List actions filtered by type and date range.

        Args:
            action_type: Action type to filter by
            start_date: Start of date range (inclusive)
            end_date: End of date range (inclusive)
            limit: Maximum number of actions to return
            offset: Number of actions to skip

        Returns:
            List of task actions
        """
        conditions = ["action_type = %s"]
        params = [action_type]

        if start_date:
            conditions.append("created_at >= %s")
            params.append(start_date)

        if end_date:
            conditions.append("created_at <= %s")
            params.append(end_date)

        where_clause = " AND ".join(conditions)

        sql = f"""
            SELECT
                id, task_id, approval_id, action_type, from_status, to_status,
                actor, reason_codes, detail, tool_name, snapshot, created_at
            FROM ai_task_actions
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """

        params.extend([limit, offset])

        async with self.conn.cursor() as cur:
            await cur.execute(sql, params)
            rows = await cur.fetchall()

            from app.tasks.models import AuditActor

            return [
                TaskActionDTO(
                    id=row[0],
                    task_id=row[1],
                    approval_id=row[2],
                    action_type=row[3],
                    from_status=row[4],
                    to_status=row[5],
                    actor=AuditActor(**row[6]),
                    reason_codes=row[7] or [],
                    detail=row[8],
                    tool_name=row[9],
                    snapshot=row[10] or {},
                    created_at=row[11],
                )
                for row in rows
            ]

    async def list_actions_by_actor(
        self,
        actor_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[TaskActionDTO]:
        """List actions filtered by actor and date range.

        Args:
            actor_id: Actor ID to filter by
            start_date: Start of date range (inclusive)
            end_date: End of date range (inclusive)
            limit: Maximum number of actions to return
            offset: Number of actions to skip

        Returns:
            List of task actions
        """
        conditions = ["actor->>'id' = %s"]
        params = [actor_id]

        if start_date:
            conditions.append("created_at >= %s")
            params.append(start_date)

        if end_date:
            conditions.append("created_at <= %s")
            params.append(end_date)

        where_clause = " AND ".join(conditions)

        sql = f"""
            SELECT
                id, task_id, approval_id, action_type, from_status, to_status,
                actor, reason_codes, detail, tool_name, snapshot, created_at
            FROM ai_task_actions
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """

        params.extend([limit, offset])

        async with self.conn.cursor() as cur:
            await cur.execute(sql, params)
            rows = await cur.fetchall()

            from app.tasks.models import AuditActor

            return [
                TaskActionDTO(
                    id=row[0],
                    task_id=row[1],
                    approval_id=row[2],
                    action_type=row[3],
                    from_status=row[4],
                    to_status=row[5],
                    actor=AuditActor(**row[6]),
                    reason_codes=row[7] or [],
                    detail=row[8],
                    tool_name=row[9],
                    snapshot=row[10] or {},
                    created_at=row[11],
                )
                for row in rows
            ]

    async def list_actions_by_approval(
        self,
        approval_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> list[TaskActionDTO]:
        """List actions filtered by approval ID.

        Args:
            approval_id: Approval ID to filter by
            limit: Maximum number of actions to return
            offset: Number of actions to skip

        Returns:
            List of task actions
        """
        sql = """
            SELECT
                id, task_id, approval_id, action_type, from_status, to_status,
                actor, reason_codes, detail, tool_name, snapshot, created_at
            FROM ai_task_actions
            WHERE approval_id = %s
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """

        async with self.conn.cursor() as cur:
            await cur.execute(sql, (approval_id, limit, offset))
            rows = await cur.fetchall()

            from app.tasks.models import AuditActor

            return [
                TaskActionDTO(
                    id=row[0],
                    task_id=row[1],
                    approval_id=row[2],
                    action_type=row[3],
                    from_status=row[4],
                    to_status=row[5],
                    actor=AuditActor(**row[6]),
                    reason_codes=row[7] or [],
                    detail=row[8],
                    tool_name=row[9],
                    snapshot=row[10] or {},
                    created_at=row[11],
                )
                for row in rows
            ]

    async def get_cross_task_activity(
        self,
        start_date: datetime,
        end_date: datetime,
        action_types: Optional[list[str]] = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> list[TaskActionDTO]:
        """Get cross-task activity view for reporting.

        Args:
            start_date: Start of date range (inclusive)
            end_date: End of date range (inclusive)
            action_types: Optional list of action types to filter by
            limit: Maximum number of actions to return
            offset: Number of actions to skip

        Returns:
            List of task actions across all tasks
        """
        conditions = ["created_at >= %s", "created_at <= %s"]
        params = [start_date, end_date]

        if action_types:
            placeholders = ", ".join(["%s"] * len(action_types))
            conditions.append(f"action_type IN ({placeholders})")
            params.extend(action_types)

        where_clause = " AND ".join(conditions)

        sql = f"""
            SELECT
                id, task_id, approval_id, action_type, from_status, to_status,
                actor, reason_codes, detail, tool_name, snapshot, created_at
            FROM ai_task_actions
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """

        params.extend([limit, offset])

        async with self.conn.cursor() as cur:
            await cur.execute(sql, params)
            rows = await cur.fetchall()

            from app.tasks.models import AuditActor

            return [
                TaskActionDTO(
                    id=row[0],
                    task_id=row[1],
                    approval_id=row[2],
                    action_type=row[3],
                    from_status=row[4],
                    to_status=row[5],
                    actor=AuditActor(**row[6]),
                    reason_codes=row[7] or [],
                    detail=row[8],
                    tool_name=row[9],
                    snapshot=row[10] or {},
                    created_at=row[11],
                )
                for row in rows
            ]
