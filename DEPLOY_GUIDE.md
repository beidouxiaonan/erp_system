# ERP System Pro 部署指南

本系统包含 Python 后端 (FastAPI) 和 React 前端。
已配置为“单体应用”模式：后端 API 可直接通过静态文件服务托管前端页面，简化部署。

## 1. 环境准备

### 1-A. 安装 Python
- 下载并安装 Python 3.9 或更高版本: [Python Downloads](https://www.python.org/downloads/)
- **重要**: 安装时请勾选 "Add Python to PATH"。

### 1-B. 安装 Node.js (仅编译前端需要)
- 如果您需要重新修改或编译前端代码，请安装 Node.js: [Node.js Downloads](https://nodejs.org/)
- 如果直接使用已打包好的 `figmaui/dist`，则不需要安装 Node.js。

---

## 2. 编译前端 (开发人员步骤)

如果您已经有 `figmaui/dist` 文件夹，请跳过此步骤。

1. 打开命令行 (CMD/PowerShell)
2. 进入前端目录: `cd figmaui`
3. 安装依赖: `npm install`
4. 执行构建: `npm run build`
5. 构建完成后，确认生成的 `dist` 文件夹位于 `figmaui/dist`。

---

## 3. 启动部署

### 方法 A: 使用一键启动脚本 (推荐)
1. 双击运行根目录下的 `start_system.bat`。
2. 脚本会自动安装 Python 依赖并启动服务。
3. 浏览器会自动打开或请手动访问 `http://localhost:8000`。

### 方法 B: 手动启动
1. 打开命令行，进入项目根目录。
2. 安装后端依赖:
   ```bash
   pip install -r requirements.txt
   ```
3. 启动服务器:
   ```bash
   python api.py
   ```
4. 看到 `Initialize database...` 提示即表示启动成功。

---

## 4. 常见问题

**Q: 启动时报错 "No module named ..."**
A: 请确保运行了 `pip install -r requirements.txt`。

**Q: 打开浏览器显示 404 Not Found**
A: 请检查 `figmaui/dist` 目录是否存在。如果不存在，后端仅提供 API 服务，没有前端页面。请参考“编译前端”步骤。

**Q: 数据库在哪里？**
A: 数据存储在文件 `factory_mes_V1.db` 中。如果误删，重启服务会自动重建（但数据会丢失）。

**Q: 默认账号是什么？**
- 管理员: `admin` / `admin123`
- 质检员: `qa01` / `123456`
- 包装员: `pkg01` / `123456`
