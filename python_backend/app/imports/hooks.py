from abc import ABC, abstractmethod
from typing import Any


class PostImportHook(ABC):
    @abstractmethod
    async def execute(self, batch_id: str, records: list[dict]) -> dict[str, Any]:
        pass


class RuleCheckHook(PostImportHook):
    async def execute(self, batch_id: str, records: list[dict]) -> dict[str, Any]:
        return {
            "batch_id": batch_id,
            "rule_check_triggered": True,
            "records_checked": len(records),
        }


class HookRegistry:
    def __init__(self):
        self._hooks: list[PostImportHook] = []

    def register(self, hook: PostImportHook) -> None:
        self._hooks.append(hook)

    async def execute_all(self, batch_id: str, records: list[dict]) -> list[dict[str, Any]]:
        results = []
        for hook in self._hooks:
            result = await hook.execute(batch_id, records)
            results.append(result)
        return results


_registry = HookRegistry()


def get_hook_registry() -> HookRegistry:
    return _registry
