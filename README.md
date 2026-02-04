# ERP System Integration

这是一个使用React前端和FastAPI后端构建的完整ERP系统，用于工厂生产管理。

## 项目结构

```
erp-system-pro/
├── api.py                 # FastAPI后端应用
├── database.py           # 数据库配置
├── auth.py              # 认证模块
├── requirements.txt      # Python依赖
├── figmaui/             # React前端应用
│   ├── src/
│   │   ├── pages/       # 页面组件
│   │   ├── components/  # 可复用组件
│   │   ├── config/      # 配置文件
│   │   └── App.tsx      # 主应用
│   ├── package.json
│   └── .env             # 环境配置
└── README.md
```

## 快速开始

### 方式一：使用Python脚本启动（推荐）

如果您的系统上没有安装Node.js/npm，可以使用以下方式启动：

**启动后端API：**
```bash
python api.py
```
API将运行在 `http://localhost:8000`

**在另一个终端启动前端服务器：**
```bash
python server.py
```
前端将运行在 `http://localhost:8080`

然后在浏览器中打开 `http://localhost:8080`

### 方式二：使用npm启动（需要Node.js）

#### 1. 后端启动

```bash
# 安装依赖
pip install -r requirements.txt

# 运行服务
python api.py
```
后端服务运行在 `http://localhost:8000`

#### 2. 前端启动

```bash
# 进入前端目录
cd figmaui

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```
前端应用运行在 `http://localhost:5173`

### 方式三：使用脚本启动（仅Windows）

#### Windows
```bash
run.bat
```

#### Linux/Mac
```bash
bash run.sh
```

## 系统功能

### 1. 数据导入
- 支持Excel、CSV格式文件导入
- 批量数据处理

### 2. 质检录入
- 生产单号、批次号输入
- 合格/不合格数量统计
- 自动计算结算金额
- 查看历史记录

### 3. 包装录入
- 选择包装工
- 支持"只包装"和"剪包"两种类型
- 数量增减调整
- 包装工绩效统计

### 4. 看板分析
- 实时数据统计
- 质检和包装的综合分析
- 按类型查看数据表格

## API 接口文档

### Dashboard
- `GET /dashboard/overview` - 获取仪表板概览数据

### 质检管理
- `POST /qa/entry` - 创建质检记录
- `GET /qa/history` - 获取质检历史记录

### 包装管理
- `POST /pkg/entry` - 创建包装记录
- `GET /pkg/history` - 获取包装历史记录

### 主数据
- `GET /workers` - 获取工人列表
- `GET /prices` - 获取价格信息

## 数据库表结构

### qa_flow（质检流水表）
| 字段 | 类型 | 说明 |
|------|------|------|
| ID | INTEGER | 主键 |
| 生产单号 | TEXT | 生产单号 |
| 产品批次号 | TEXT | 批次号 |
| 合格数量 | INTEGER | 合格数 |
| 不合格数量 | INTEGER | 不合格数 |
| 录入时间 | TEXT | 录入时间 |
| 操作时间 | TEXT | 操作时间 |
| 结算金额 | INTEGER | 结算金额 |

### pkg_flow（包装流水表）
| 字段 | 类型 | 说明 |
|------|------|------|
| ID | INTEGER | 主键 |
| 包装工 | TEXT | 包装工号 |
| 类型 | TEXT | 包装类型 |
| 数量 | INTEGER | 包装数量 |
| 录入时间 | TEXT | 录入时间 |
| 结算金额 | INTEGER | 结算金额 |

## 环境配置

### 前端环境变量
编辑 `.env` 文件配置API地址：
```
VITE_API_URL=http://localhost:8000
```

生产环境配置编辑 `.env.production`：
```
VITE_API_URL=http://api.your-domain.com
```

## 开发指南

### 前端依赖
- React 18.3.1
- TypeScript
- Tailwind CSS
- Vite
- Lucide React（图标库）

### 后端依赖
- FastAPI 0.104.1
- Uvicorn 0.24.0
- Pandas 2.1.4
- Python 3.8+

## 部署

### 生产构建

#### 前端
```bash
cd figmaui
npm run build
```

#### 后端
```bash
pip install -r requirements.txt
python api.py --host 0.0.0.0 --port 8000
```

## 常见问题

**Q: 前端显示空白页或无法连接到后端**
A: 确保：
1. 后端API正在运行：`python api.py` (http://localhost:8000)
2. 前端服务器正在运行：`python server.py` (http://localhost:8080)
3. 两个终端都没有报错

**Q: npm不可用怎么办？**
A: 使用Python方式启动。运行 `python server.py` 启动前端，然后访问 `http://localhost:8080`

**Q: 数据库错误**
A: 确保`factory_mes_V1.db`数据库文件存在，或运行`database.py`初始化数据库。

**Q: 依赖安装失败**
A: 如果使用npm，清除缓存后重试：`npm cache clean --force` 和 `pip cache purge`

**Q: 如何同时运行后端和前端？**
A: 在不同的终端窗口中分别运行：
   - 终端1：`python api.py`
   - 终端2：`python server.py`
   - 然后访问 `http://localhost:8080`

## 许可证

MIT