# 路由映射说明

本文档说明了 prototype 原型页面与实际路由的对应关系。

## Prototype 页面映射

| Prototype 目录 | 页面标题 | 对应路由 | React 组件 |
|---------------|---------|---------|-----------|
| `_1/` | Equipment Management | `/equipment` | `EquipmentManagement.tsx` |
| `_2/` | Alert Center | `/alerts` | `AlertCenter.tsx` |
| `_3/` | Chemical Inbound Entry | `/inbound-outbound` | `InboundOutbound.tsx` |
| `_4/` | Chemical Inventory | `/chemicals` | `ChemicalInventory.tsx` |
| `_5/` | Inbound/Outbound Records | `/inbound-outbound` | `InboundOutbound.tsx` |
| `_6/` | Material Ops (Dashboard) | `/dashboard` | `Dashboard.tsx` |
| `_7/` | Maintenance Records | `/maintenance` | `MaintenanceRecords.tsx` |

## 新增页面

根据设计文档，新增了以下页面：

| 路由 | React 组件 | 说明 |
|------|-----------|------|
| `/ai-analysis` | `AIAnalysis.tsx` | AI 分析页面 |
| `/settings` | `SystemSettings.tsx` | 系统设置页面 |

## 页面功能对照

### 1. 首页概览 (`/dashboard`)
- **原型**: `_6/code.html` (Material Ops)
- **功能**: 
  - 数据统计卡片
  - 低库存化学品列表
  - 近期维护记录

### 2. 化学品管理 (`/chemicals`)
- **原型**: `_4/code.html` (Chemical Inventory)
- **功能**:
  - 化学品列表展示
  - 搜索和筛选
  - 库存状态标识
  - 详情查看

### 3. 出入库记录 (`/inbound-outbound`)
- **原型**: `_3/code.html` + `_5/code.html`
- **功能**:
  - 入库记录
  - 出库记录
  - 历史记录查询
  - 新增入库/出库

### 4. 仪器设备 (`/equipment`)
- **原型**: `_1/code.html` (Equipment Management)
- **功能**:
  - 设备列表（卡片式）
  - 设备状态管理
  - 维护时间提醒
  - 设备详情

### 5. 维护记录 (`/maintenance`)
- **原型**: `_7/code.html` (Maintenance Records)
- **功能**:
  - 维护记录列表
  - 时间筛选
  - 图片附件
  - 详情查看

### 6. 预警中心 (`/alerts`)
- **原型**: `_2/code.html` (Alert Center)
- **功能**:
  - 预警统计
  - 低库存提醒
  - 待维护设备
  - 异常设备

### 7. AI 分析 (`/ai-analysis`)
- **原型**: 无（新增）
- **功能**:
  - 智能问答
  - 库存趋势分析
  - 高频使用统计
  - 异常波动提醒

### 8. 系统设置 (`/settings`)
- **原型**: 无（新增）
- **功能**:
  - 用户管理
  - 预警阈值设置
  - 分类管理
  - 通知配置

## 导航结构

```
实验室物料管理平台
├── 首页概览 (/dashboard)
├── 化学品管理 (/chemicals)
├── 出入库记录 (/inbound-outbound)
├── 仪器设备 (/equipment)
├── 维护记录 (/maintenance)
├── 预警中心 (/alerts)
├── AI 分析 (/ai-analysis)
└── 系统设置 (/settings)
```

## 设计一致性

所有页面遵循统一的设计规范：

1. **布局**: 左侧导航 + 主内容区
2. **配色**: 使用 Tailwind 自定义配色方案
3. **组件**: Material Symbols 图标
4. **交互**: 统一的按钮、卡片、表格样式
5. **状态**: 清晰的状态标签和颜色标识

## 权限控制（待实现）

- **管理员**: 可访问所有页面，可执行所有操作
- **普通成员**: 可访问查看类页面，隐藏写入操作按钮

需要在后续开发中实现基于角色的权限控制。
