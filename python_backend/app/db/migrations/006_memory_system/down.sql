-- Migration: 006_memory_system (Rollback)
-- Description: Remove AI Memory system tables
-- Author: AI Agent
-- Date: 2026-05-06

-- 删除表（注意顺序，先删除有外键依赖的表）
DROP TABLE IF EXISTS ai_memory_applications;
DROP TABLE IF EXISTS ai_memories;
