-- Migration: 006_memory_system
-- Description: Add AI Memory system tables for learning and optimization
-- Author: AI Agent
-- Date: 2026-05-06

-- AI Memory 表：存储 AI 员工的学习记忆
CREATE TABLE IF NOT EXISTS ai_memories (
  id TEXT PRIMARY KEY,
  memory_type TEXT NOT NULL,  -- 'pattern', 'lesson', 'optimization', 'feedback'
  category TEXT NOT NULL,      -- 'task_execution', 'approval_decision', 'sla_handling', 'resource_allocation'
  context_key TEXT NOT NULL,   -- 用于检索的上下文键（如 'restock_chemical_X', 'maintenance_equipment_Y'）

  -- 记忆内容
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  insight TEXT NOT NULL,       -- 核心洞察
  confidence_score FLOAT NOT NULL DEFAULT 0.5,  -- 置信度 0-1

  -- 关联数据
  source_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_entities JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {sourceType, sourceId, sourceName}

  -- 应用统计
  applied_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_applied_at TIMESTAMPTZ NULL,

  -- 元数据
  created_by JSONB NOT NULL DEFAULT '{}'::jsonb,  -- AuditActor
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NULL,  -- 可选的过期时间
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Memory Application Log：记录记忆的应用历史
CREATE TABLE IF NOT EXISTS ai_memory_applications (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  task_id TEXT NULL,
  event_id TEXT NULL,

  application_type TEXT NOT NULL,  -- 'suggestion', 'auto_applied', 'rejected'
  outcome TEXT NULL,               -- 'success', 'failure', 'pending'
  impact_score FLOAT NULL,         -- 影响评分 -1 到 1

  actor JSONB NOT NULL DEFAULT '{}'::jsonb,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT fk_memory_applications_memory_id FOREIGN KEY (memory_id) REFERENCES ai_memories (id) ON DELETE CASCADE,
  CONSTRAINT fk_memory_applications_task_id FOREIGN KEY (task_id) REFERENCES ai_tasks (id) ON DELETE SET NULL
);

-- 索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_ai_memories_type_category
  ON ai_memories (memory_type, category);

CREATE INDEX IF NOT EXISTS idx_ai_memories_context_key
  ON ai_memories (context_key);

CREATE INDEX IF NOT EXISTS idx_ai_memories_confidence_score
  ON ai_memories (confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_ai_memories_created_at
  ON ai_memories (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_memories_expires_at
  ON ai_memories (expires_at NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_ai_memory_applications_memory_id
  ON ai_memory_applications (memory_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_memory_applications_task_id
  ON ai_memory_applications (task_id);

CREATE INDEX IF NOT EXISTS idx_ai_memory_applications_outcome
  ON ai_memory_applications (outcome, created_at DESC);

-- 注释
COMMENT ON TABLE ai_memories IS 'AI员工的学习记忆，用于优化决策';
COMMENT ON TABLE ai_memory_applications IS '记忆应用历史，用于追踪记忆的有效性';
COMMENT ON COLUMN ai_memories.context_key IS '检索键，用于快速查找相关记忆';
COMMENT ON COLUMN ai_memories.confidence_score IS '记忆的置信度，范围0-1，随应用结果动态调整';
COMMENT ON COLUMN ai_memory_applications.impact_score IS '应用影响评分，-1（负面）到1（正面）';
