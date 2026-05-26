# 实验室物料管理平台

基于设计文档构建的实验室物料管理系统前端项目。

## 技术栈

- React 18
- TypeScript
- React Router v6
- Tailwind CSS
- Vite

## 项目结构

```
LabManager/
├── src/
│   ├── layouts/
│   │   └── MainLayout.tsx          # 主布局（左侧导航 + 内容区）
│   ├── pages/
│   │   ├── Dashboard.tsx           # 首页概览
│   │   ├── ChemicalInventory.tsx   # 化学品管理
│   │   ├── InboundOutbound.tsx     # 出入库记录
│   │   ├── EquipmentManagement.tsx # 仪器设备
│   │   ├── MaintenanceRecords.tsx  # 维护记录
│   │   ├── AlertCenter.tsx         # 预警中心
│   │   ├── AIAnalysis.tsx          # AI 分析
│   │   └── SystemSettings.tsx      # 系统设置
│   ├── App.tsx                     # 路由配置
│   ├── main.tsx                    # 应用入口
│   └── index.css                   # 全局样式
├── docs/
│   └── frontend-design-spec.md     # 前端设计文档
├── prototype/                      # 原型页面（HTML）
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 路由结构

根据设计文档的导航架构，配置了以下路由：

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | - | 重定向到 `/dashboard` |
| `/dashboard` | Dashboard | 首页概览 - 数据总览、低库存列表、维护记录 |
| `/chemicals` | ChemicalInventory | 化学品管理 - 档案查看、库存状态 |
| `/inbound-outbound` | InboundOutbound | 出入库记录 - 入库/出库历史 |
| `/equipment` | EquipmentManagement | 仪器设备 - 设备档案、状态管理 |
| `/maintenance` | MaintenanceRecords | 维护记录 - 维护历史、详情查看 |
| `/alerts` | AlertCenter | 预警中心 - 低库存、待维护设备提醒 |
| `/ai-analysis` | AIAnalysis | AI 分析 - 智能分析、趋势预测 |
| `/settings` | SystemSettings | 系统设置 - 用户管理、预警配置 |

## 设计特点

### 配色方案

采用"专业实验室工作台"风格：

- **主色（深青蓝）**: 导航选中、主操作按钮
- **辅色（青绿色）**: 成功状态、可用状态
- **警示色（琥珀橙）**: 低库存预警
- **风险色（砖红色）**: 异常状态、库存告急
- **中性色**: 浅灰白背景、卡片

### 布局结构

- 左侧固定导航栏（256px）
- 主内容区自适应
- 卡片式内容展示
- 响应式设计

### 组件风格

- 圆角中等的卡片设计
- 清晰的状态标签
- Material Symbols 图标
- 柔和的阴影和边框

## 快速开始

### 前端

#### 安装依赖

```bash
npm install
```

#### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

#### 构建生产版本

```bash
npm run build
```

#### 预览生产构建

```bash
npm run preview
```

### Python 后端

#### 环境配置

Python 后端需要配置以下环境变量（使用 `LABMANAGER_PY_` 前缀）：

**必需配置（生产环境）：**
- `LABMANAGER_PY_LLM_API_KEY` - LLM 服务 API 密钥
- `LABMANAGER_PY_LLM_ENDPOINT` - LLM 服务端点 URL
- `LABMANAGER_PY_LLM_MODEL` - LLM 模型标识符
- `LABMANAGER_PY_SMTP_HOST` - SMTP 服务器主机名
- `LABMANAGER_PY_SMTP_PORT` - SMTP 服务器端口
- `LABMANAGER_PY_SMTP_USER` - SMTP 认证用户名
- `LABMANAGER_PY_SMTP_PASSWORD` - SMTP 认证密码
- `LABMANAGER_PY_SMTP_FROM` - 发件人邮箱地址

**可选配置：**
- `LABMANAGER_PY_PDF_FONT_PATH` - PDF 字体目录路径（未设置时使用系统字体）
- `LABMANAGER_PY_APP_ENV` - 环境标识（`development`/`production`，默认 `development`）

开发环境下，SMTP 配置可选（邮件将记录到文件而非发送）。

详细配置说明请参考 [部署指南](./docs/deployment-guide.md)。

#### 验证配置

在启动应用前验证配置：

```bash
python scripts/validate_config.py
```

#### 启动开发服务器

```bash
cd python_backend
uvicorn app.main:app --reload
```

访问 http://localhost:8001

## 仓库交付与提交策略

本仓库默认只提交可审查、可构建、可发布的最小集合，也就是源码、声明式配置、模板文件和必要文档。以下内容不应作为日常仓库内容提交：

- 依赖目录：`node_modules/`
- 构建产物：`dist/`、`build/`、`.vite/`、覆盖率与缓存目录
- 临时交付物：`*.zip`、`*.tar`、`*.gz`、`*.7z` 等压缩包
- 机器导出产物：例如 `mermaid-diagram-*.png` 这类临时导出图片
- 真实环境文件：`.env`、`.env.local`、`.env.production`、`.env.staging` 及其本地变体

环境配置采用“模板可入库，真实值不入库”的策略：

- 后端示例配置使用 [backend/.env.example](/D:/Documents/Codes/Project/_Studio/LabManager/backend/.env.example)
- 前端示例配置使用 [frontend/.env.example](/D:/Documents/Codes/Project/_Studio/LabManager/frontend/.env.example)
- 本地开发或部署时，请在各自目录创建真实 `.env*` 文件，但不要提交这些文件

以下内容可以继续纳入版本控制：

- `frontend/public/imported-data/` 下作为演示或样例输入存在的静态资源
- `prototype/` 下用于原型说明的 `code.html` 与 `screen.png`
- `docs/`、`openspec/`、前后端源码、锁文件和不含敏感值的模板配置

如果后续新增工具链、输出目录或生成型文件类型，需要在同一变更中同步更新根目录 `.gitignore` 或本说明，避免仓库交付面再次膨胀。

## 页面功能说明

### 1. 首页概览 (Dashboard)
- 6个关键数据统计卡片
- 低库存化学品列表
- 近期维护记录列表

### 2. 化学品管理 (ChemicalInventory)
- 搜索和筛选功能
- 表格展示化学品信息
- 库存状态标签
- 新增/编辑/查看详情

### 3. 出入库记录 (InboundOutbound)
- 入库/出库记录切换
- 时间范围筛选
- 操作类型标识
- 详细记录查看

### 4. 仪器设备 (EquipmentManagement)
- 卡片式设备展示
- 设备状态标识（可用/维护中/故障）
- 维护时间提醒
- 设备详情查看

### 5. 维护记录 (MaintenanceRecords)
- 时间线式记录展示
- 维护状态标识
- 图片附件预览
- 详细内容查看

### 6. 预警中心 (AlertCenter)
- 预警统计概览
- 分类预警列表
- 优先级标识
- 快速操作入口

### 7. AI 分析 (AIAnalysis)
- 智能问答入口
- 库存趋势分析
- 高频使用统计
- 异常波动提醒

### 8. 系统设置 (SystemSettings)
- 用户管理
- 预警阈值配置
- 分类管理
- 通知设置

## 后续开发计划

- [ ] 集成后端 API
- [ ] 实现用户认证和权限控制
- [ ] 添加表单验证
- [ ] 实现图片上传功能
- [ ] 添加数据可视化图表
- [ ] 实现 AI 分析功能
- [ ] 添加导出功能
- [ ] 移动端适配优化

## 参考文档

- [前端设计规范](./docs/frontend-design-spec.md)
- [React Router 文档](https://reactrouter.com/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
