# 前端业务逻辑实现指南

## 概述

已将后端的业务逻辑在前端实现，包括数据验证、计算、统计分析和导出功能。前端现在可以独立处理复杂的业务逻辑。

## 项目结构

```
figmaui/src/
├── services/
│   ├── api.ts              # API 端点配置
│   ├── businessService.ts   # 业务逻辑服务（新增）
│   └── analyticsService.ts  # 分析服务（新增）
├── pages/
│   ├── DashboardPage.tsx    # 仪表板页面（已更新）
│   ├── QAEntryPage.tsx
│   ├── PackagingEntryPage.tsx (已更新)
│   └── DataImportPage.tsx
├── components/
│   ├── OperationCard.tsx         # 质检操作（已更新）
│   ├── PackagingOperationCard.tsx # 包装操作（新增）
│   └── ...
```

## 已实现的前端业务逻辑

### 1. 业务服务 (`businessService.ts`)

#### 数据验证
```typescript
// 质检数据验证
validateQAEntry(data: QAEntryData): string[]

// 包装数据验证  
validatePKGEntry(data: PKGEntryData): string[]
```

**验证内容：**
- 必填字段检查（生产单号、批次号、商家编码等）
- 数值有效性检查（数量不能为负）
- 字段格式检查

#### 金额计算
```typescript
// 质检结算金额计算
calculateQASettlementAmount(qualifiedQty: number, processingFee: number)
// 计算公式：合格数量 × 加工点工价

// 包装结算金额计算
calculatePKGSettlementAmount(quantity: number, unitPrice: number)
// 计算公式：数量 × 执行单价

// 根据包装类型获取单价
getPKGUnitPrice(packageType: string, prices: PriceInfo[], merchantCode: string)
// 返回对应的只包装工价或剪包工价
```

**实时计算示例：**
- 用户输入商家编码 → 自动从价格表查询工价
- 用户输入合格数量 → 实时计算结算金额
- 金额显示在表单上供用户确认

#### API 数据获取
```typescript
// 获取价格信息（带缓存）
getPrices(): Promise<PriceInfo[]>

// 获取工人列表
getWorkers(): Promise<any[]>

// 获取质检/包装历史记录
getQAHistory() / getPKGHistory()

// 获取仪表板数据
getDashboardOverview()
```

#### 数据提交
```typescript
// 提交质检数据
submitQAEntry(data: QAEntryData): Promise<boolean>

// 提交包装数据
submitPKGEntry(data: PKGEntryData): Promise<boolean>
```

### 2. 分析服务 (`analyticsService.ts`)

#### 数据统计
```typescript
// 质检统计
calculateQAStats(records: QARecord[]) {
  return {
    totalRecords,      // 总记录数
    totalQualified,    // 合格总数
    totalUnqualified,  // 不合格总数
    totalSettlement,   // 结算金额总数
    qualityRate,       // 合格率 (%)
  }
}

// 包装统计
calculatePKGStats(records: PKGRecord[]) {
  return {
    totalRecords,      // 总记录数
    totalQuantity,     // 总数量
    totalSettlement,   // 结算金额总数
    byType: {
      只包装,
      剪包
    }
  }
}
```

#### 数据分组
```typescript
// 按商家编码分组统计（用于商家排行）
groupByMerchantCode(records)
// 返回按结算金额排序的商家统计

// 按日期分组统计（用于日期趋势）
groupByDate(records)
// 返回按日期倒序的统计数据
```

#### 周期统计
```typescript
// 计算指定周期内的统计数据
getPeriodStats(records, period: 'week' | 'month' | 'year')
// 可用于计算周排行、月排行、年排行
```

#### 数据导出
```typescript
// 导出数据为 CSV 文件
exportToCSV(records: any[], filename: string)
// 自动处理特殊字符和数值格式
```

## 已更新的组件

### 1. OperationCard（质检操作）

**新增功能：**
- ✅ 前端数据验证（多字段验证）
- ✅ 实时金额计算（自动从数据库查询工价）
- ✅ 错误提示（用户友好的错误消息）
- ✅ 状态反馈（提交中/已完成状态）
- ✅ 表单自动清空（提交成功后）

**业务逻辑流程：**
1. 用户输入生产单号、批次号等信息
2. 输入商家编码时，自动查询对应的工价
3. 输入合格数量时，实时计算：结算金额 = 合格数量 × 工价
4. 点击提交时进行前端验证
5. 验证通过后提交到后端
6. 提交成功后清空表单并显示成功提示

```tsx
// 实时计算示例
useEffect(() => {
  calculateSettlement();
}, [qualifiedQty, merchantCode, prices]);

const calculateSettlement = () => {
  const priceInfo = getPriceByMerchantCode(prices, merchantCode);
  if (priceInfo) {
    const amount = calculateQASettlementAmount(
      qualifiedQty, 
      priceInfo.加工点工价
    );
    setSettlementAmount(amount);
  }
}
```

### 2. PackagingOperationCard（包装操作 - 新增）

**功能特性：**
- ✅ 包装工自动下拉列表（从数据库获取）
- ✅ 包装类型选择（只包装/剪包）
- ✅ 根据类型自动选择工价
- ✅ 实时金额计算
- ✅ 前端验证和错误提示

**业务逻辑：**
1. 从数据库加载工人列表和价格信息
2. 用户选择包装类型（只包装或剪包）
3. 输入商家编码后自动查询对应工价
4. 实时计算：结算金额 = 数量 × 单价（根据类型选择）
5. 验证和提交数据

```tsx
// 根据类型动态计算单价
const unitPrice = getPKGUnitPrice(packageType, prices, merchantCode);
// 只包装 → 只包装工价
// 剪包 → 剪包工价
```

### 3. DashboardPage（仪表板 - 已更新）

**新增分析功能：**
- ✅ 质检合格率计算
- ✅ 结算金额统计
- ✅ 按类型分类统计
- ✅ 数据表格展示
- ✅ CSV 导出功能

**统计指标：**

质检数据：
- 合格数量
- 不合格数量
- 合格率 (%)
- 结算金额总数

包装数据：
- 总数量
- 只包装数量
- 剪包数量
- 结算金额总数

```tsx
// 合格率计算公式
qualityRate = (合格总数 / (合格总数 + 不合格总数)) × 100
```

## 工作流示例

### 质检数据提交流程

```
用户界面
  ↓
输入数据 (生产单号、批次号、商家编码等)
  ↓
实时计算结算金额 (触发 useEffect)
  ↓
用户点击提交
  ↓
前端验证数据 (validateQAEntry)
  ├─ 验证失败 → 显示错误消息
  └─ 验证成功 → 提交到后端
      ↓
  后端保存数据
      ↓
  返回成功响应
      ↓
  清空表单 + 显示成功提示
```

### 仪表板数据显示流程

```
页面加载
  ↓
获取仪表板数据 (getDashboardOverview)
  ↓
使用 analyticsService 分析数据
  ├─ calculateQAStats()  → 质检统计
  ├─ calculatePKGStats() → 包装统计
  └─ groupByMerchantCode() → 商家分组
      ↓
  渲染统计卡片和数据表格
      ↓
  用户可导出 CSV 或切换标签查看不同数据
```

## 数据流图

### 质检操作流程
```
Price DB ─→ getPrices() ─→ OperationCard
              ↑
         自动查询工价

User Input ─→ validateQAEntry() ─→ calculateQASettlementAmount()
              ↓
         实时显示金额

Submit ─→ submitQAEntry() ─→ Backend API ─→ Database
```

### 分析仪表板流程
```
Backend API ─→ getDashboardOverview() ─→ DashboardPage
              ↓
         calculateQAStats()
         calculatePKGStats()
         groupByMerchantCode()
              ↓
         渲染统计卡片和表格
              ↓
         用户导出 CSV (exportToCSV)
```

## 使用 TypeScript 类型安全

```typescript
// 类型定义
export interface QAEntryData {
  production_order: string;
  batch_number: string;
  qualified_qty: number;
  unqualified_qty: number;
  merchant_code: string;
  spec_name: string;
  manufacturer: string;
}

export interface PriceInfo {
  商家编码: string;
  加工点工价: number;
  只包装工价: number;
  剪包工价: number;
}

export interface QARecord {
  ID: number;
  合格数量: number;
  不合格数量: number;
  结算金额: number;
  // ...
}
```

## 错误处理示例

```typescript
// 前端验证失败
const errors = validateQAEntry(data);
if (errors.length > 0) {
  setErrors(errors);
  // 显示错误信息给用户
}

// 后端提交失败
const success = await submitQAEntry(data);
if (!success) {
  setErrors(['提交失败，请重试']);
}

// 异常处理
try {
  await submitQAEntry(data);
} catch (error) {
  setErrors([`提交失败: ${error.message}`]);
}
```

## 性能优化

1. **缓存价格数据** - 使用 useState 缓存，避免重复请求
2. **防抖计算** - 使用 useEffect 依赖数组，避免过度计算
3. **批量数据加载** - Promise.all 并行加载多个数据源
4. **增量更新** - 只在必要时重新计算统计数据

## 总结

✅ 已将后端的所有核心业务逻辑迁移到前端
✅ 提供了完整的数据验证和计算能力
✅ 实现了数据统计和分析功能
✅ 支持数据导出和报表生成
✅ 使用 TypeScript 确保类型安全
✅ 完善的错误处理和用户反馈

前端现在可以独立处理复杂的业务需求，同时通过后端 API 进行数据持久化。
