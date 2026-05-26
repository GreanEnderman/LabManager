-- Remove activity log indexes

DROP INDEX IF EXISTS idx_task_actions_action_type;
DROP INDEX IF EXISTS idx_task_actions_actor;
DROP INDEX IF EXISTS idx_task_actions_approval_id;
DROP INDEX IF EXISTS idx_task_actions_created_at;
