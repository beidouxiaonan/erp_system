# ERP 系统 - 前后端集成指南

## 系统架构

```
后端 (FastAPI)          前端 (React + TypeScript)
localhost:8000   <-->   localhost:5173
```

## API 接口调用示例

### 1. 获取仪表板数据

**前端代码** (`DashboardPage.tsx`):
```typescript
const response = await fetch('http://localhost:8000/dashboard/overview');
const data = await response.json();
```

**后端端点** (`api.py`):
```python
@app.get("/dashboard/overview")
def get_dashboard_overview(db: sqlite3.Connection = Depends(get_db)):
    # 返回: total_orders, total_qa_entries, total_pkg_entries, qa_data, pkg_data
```

### 2. 提交质检记录

**前端代码** (`OperationCard.tsx`):
```typescript
const response = await fetch('http://localhost:8000/qa/entry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    production_order: productionOrder,
    batch_number: batchNumber,
    qualified_qty: qualifiedQty,
    unqualified_qty: unqualifiedQty,
    merchant_code: merchantCode,
    spec_name: specName,
    manufacturer: manufacturer,
  }),
});
```

**后端端点** (`api.py`):
```python
@app.post("/qa/entry")
def create_qa_entry(entry: QAEntry, db: sqlite3.Connection = Depends(get_db)):
    # 保存到数据库
```

## API 配置

所有 API 端点配置在: `figmaui/src/config/api.ts`

```typescript
export const API_BASE_URL = 'http://localhost:8000';

export const API_ENDPOINTS = {
  DASHBOARD_OVERVIEW: `${API_BASE_URL}/dashboard/overview`,
  QA_ENTRY: `${API_BASE_URL}/qa/entry`,
  QA_HISTORY: `${API_BASE_URL}/qa/history`,
  PKG_ENTRY: `${API_BASE_URL}/pkg/entry`,
  PKG_HISTORY: `${API_BASE_URL}/pkg/history`,
  WORKERS: `${API_BASE_URL}/workers`,
  PRICES: `${API_BASE_URL}/prices`,
};
```

## 已实现的功能

✅ **DashboardPage** - 获取仪表板概览数据
✅ **OperationCard** - 提交质检数据到后端
✅ **CORS 配置** - 前端可以调用后端 API
✅ **数据库连接** - 后端连接 SQLite 数据库

## 测试步骤

1. **启动后端**: `python api.py` (运行在 http://localhost:8000)
2. **启动前端**: `npm run dev` 在 figmaui 目录 (运行在 http://localhost:5173)
3. **打开浏览器**: http://localhost:5173
4. **查看仪表板**: 自动从后端获取数据
5. **提交质检记录**: 
   - 进入"质检入库记录"页面
   - 填写表单字段
   - 点击"提交"按钮
   - 数据保存到后端数据库

## 后端 API 文档

访问 http://localhost:8000/docs 查看完整的 API 文档 (Swagger UI)

## 常见问题

**Q: 前端无法连接后端？**
A: 检查后端是否运行在 localhost:8000，CORS 已配置允许 localhost:5173

**Q: 数据没有保存？**
A: 检查数据库文件 `factory_mes_V1.db` 是否存在，或运行初始化脚本

**Q: API 报错 500？**
A: 检查后端控制台的错误信息，通常是数据库表不存在或字段类型不匹配
