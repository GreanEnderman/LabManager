-- Add indexes for activity log queries
-- These indexes optimize filtering by action_type, actor, and approval_id

-- Index for action_type queries
CREATE INDEX IF NOT EXISTS idx_task_actions_action_type
ON ai_task_actions(action_type, created_at DESC);

-- Index for actor queries (using JSONB operator)
CREATE INDEX IF NOT EXISTS idx_task_actions_actor
ON ai_task_actions((actor->>'id'), created_at DESC);

-- Index for approval_id queries
CREATE INDEX IF NOT EXISTS idx_task_actions_approval_id
ON ai_task_actions(approval_id, created_at DESC)
WHERE approval_id IS NOT NULL;

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_task_actions_created_at
ON ai_task_actions(created_at DESC);
