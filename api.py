from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import sqlite3
import json
import math
import pandas as pd
from typing import List, Optional
from datetime import datetime
import io
import os
import database  # Import database module

app = FastAPI(title="ERP System API", version="1.0.0")

# CORS middleware to allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源（开发环境）
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
def get_db():
    conn = sqlite3.connect('factory_mes_V1.db', check_same_thread=False)
    try:
        yield conn
    finally:
        conn.close()

# Pydantic models
class QAEntry(BaseModel):
    production_order: str
    batch_number: str
    qualified_qty: int
    unqualified_qty: int
    merchant_code: str
    spec_name: str
    manufacturer: str
    order_status: Optional[str] = None
    operator: str  # 新增：操作员

class PKGEntry(BaseModel):
    worker: str
    type: str
    quantity: int
    merchant_code: str
    product_name: str
    spec_name: str
    operator: str  # 新增：操作员
    unit_price: Optional[float] = None  # 执行单价（前端计算）
    settlement_amount: Optional[float] = None  # 结算金额（前端计算）

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    name: str

class WorkerEntry(BaseModel):
    worker_id: str
    name: str
    phone: Optional[str] = ""

# API Endpoints

@app.get("/dashboard/overview")
def get_dashboard_overview(db: sqlite3.Connection = Depends(get_db)):
    try:
        # Get QA data
        qa_df = pd.read_sql("SELECT * FROM qa_flow", db)
        # Get PKG data
        pkg_df = pd.read_sql("SELECT * FROM pkg_flow", db)
        # Get orders
        orders_df = pd.read_sql("SELECT * FROM orders", db)
        # Get prices
        prices_df = pd.read_sql("SELECT * FROM prices", db)

        # Calculate overview metrics
        total_orders = len(orders_df) if not orders_df.empty else 0
        total_qa_entries = len(qa_df) if not qa_df.empty else 0
        total_pkg_entries = len(pkg_df) if not pkg_df.empty else 0

        # 使用pandas to_json处理NaN值
        qa_data = json.loads(qa_df.to_json(orient='records', force_ascii=False)) if not qa_df.empty else []
        pkg_data = json.loads(pkg_df.to_json(orient='records', force_ascii=False)) if not pkg_df.empty else []

        return {
            "total_orders": total_orders,
            "total_qa_entries": total_qa_entries,
            "total_pkg_entries": total_pkg_entries,
            "qa_data": qa_data,
            "pkg_data": pkg_data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/login")
def login(req: LoginRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT username, role, name FROM users WHERE username=? AND password=?", (req.username, req.password))
    user = cursor.fetchone()
    if user:
        return {"username": user[0], "role": user[1], "name": user[2]}
    else:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

@app.get("/users")
def get_users(db: sqlite3.Connection = Depends(get_db)):
    try:
        cursor = db.cursor()
        cursor.execute("SELECT username, role, name FROM users")
        users = [{"username": row[0], "role": row[1], "name": row[2]} for row in cursor.fetchall()]
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users")
def create_user(user: UserCreate, db: sqlite3.Connection = Depends(get_db)):
    try:
        cursor = db.cursor()
        # Check specific permission if needed, but for now we rely on frontend to hide UI
        cursor.execute("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)", 
                      (user.username, user.password, user.role, user.name))
        db.commit()
        return {"message": "User created successfully"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/users/{username}")
def delete_user(username: str, db: sqlite3.Connection = Depends(get_db)):
    try:
        cursor = db.cursor()
        if username == 'admin':
             raise HTTPException(status_code=400, detail="不能删除管理员账户")
        cursor.execute("DELETE FROM users WHERE username=?", (username,))
        db.commit()
        return {"message": "User deleted successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

class SQLQuery(BaseModel):
    sql: str

@app.post("/admin/sql")
def execute_sql(query: SQLQuery, db: sqlite3.Connection = Depends(get_db)):
    try:
        cursor = db.cursor()
        # Ensure only one statement is executed to prevent injection chaining if possible, 
        # but for admin console we want full power.
        # sqlite3 execute() usually runs one statement. executescript() runs multiple.
        # We'll use execute() which limits to one statement usually, unless user sends multiple via script.
        # But this is an ADMIN tool, so we allow it.
        
        cursor.execute(query.sql)
        
        if query.sql.strip().upper().startswith(("SELECT", "PRAGMA")):
            if cursor.description:
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                result = [dict(zip(columns, row)) for row in rows]
                return {"type": "select", "data": result}
            return {"type": "select", "data": []}
        else:
            db.commit()
            return {"type": "execute", "rows_affected": cursor.rowcount}
    except Exception as e:
        db.rollback()
        # Return the actual error message from SQLite
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/qa/entry")
def create_qa_entry(entry: QAEntry, db: sqlite3.Connection = Depends(get_db)):
    # 验证数量
    if entry.qualified_qty == 0 and entry.unqualified_qty == 0:
        raise HTTPException(status_code=400, detail="合格数量和不合格数量不能同时为0")

    try:
        cursor = db.cursor()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Get price info
        price_df = pd.read_sql(f"SELECT * FROM prices WHERE 商家编码 = '{entry.merchant_code}'", db)
        processing_fee = price_df['加工点工价'].iloc[0] if not price_df.empty else 0

        settlement_amount = entry.qualified_qty * processing_fee

        # 1. 插入质检流水
        cursor.execute("""
            INSERT INTO qa_flow (生产单号, 录入时间, 操作时间, 产品批次号, 合格数量, 不合格数量, 商家编码, 规格名称, 生产商, 加工点工价, 结算金额, 生产单状态, 操作员)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            entry.production_order, now, now, entry.batch_number,
            entry.qualified_qty, entry.unqualified_qty, entry.merchant_code,
            entry.spec_name, entry.manufacturer, processing_fee, settlement_amount, "进行中", entry.operator
        ))

        # 2. 插入日志
        try:
             cursor.execute("ALTER TABLE qa_log ADD COLUMN 操作员 TEXT")
        except:
             pass 

        cursor.execute("""
            INSERT INTO qa_log (时间, 生产单号, 商家编码, 事件, 操作详情, 操作员)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (now, entry.production_order, entry.merchant_code, "质检录入", f"合格:{entry.qualified_qty}, 不合格:{entry.unqualified_qty}", entry.operator))


        # ==========================================
        # 3. 自动状态更新逻辑
        # ==========================================
        
        # A. 确保 orders 表有状态列
        try:
           cursor.execute("ALTER TABLE orders ADD COLUMN 状态 TEXT")
        except:
           pass # 列已存在
           
        try:
           cursor.execute("ALTER TABLE orders ADD COLUMN 产品批次状态 TEXT")
        except:
           pass # 列已存在

        # B. 获取该单据的计划数量
        cursor.execute("""
            SELECT 计划生产次数 FROM orders 
            WHERE 生产单号=? AND 商家编码=? AND 规格名称=? AND 产品批次号=?
        """, (entry.production_order, entry.merchant_code, entry.spec_name, entry.batch_number))
        row = cursor.fetchone()
        planned_qty = row[0] if row else 0

        # C. 计算该单据累计合格数量
        cursor.execute("""
            SELECT SUM(合格数量) FROM qa_flow 
            WHERE 生产单号=? AND 商家编码=? AND 规格名称=? AND 产品批次号=?
        """, (entry.production_order, entry.merchant_code, entry.spec_name, entry.batch_number))
        qs = cursor.fetchone()
        total_qualified = qs[0] if qs and qs[0] else 0

        # D. 判断并更新 单据状态
        # 自动计算的状态
        auto_status = "进行中"
        if total_qualified >= planned_qty and planned_qty > 0:
            auto_status = "已完结"
        
        # 最终状态逻辑：
        # 1. 如果前端明确传了"已完结"，则强制完结
        # 2. 否则使用自动计算的状态（通过数量判断）
        current_order_status = auto_status
        if entry.order_status == "已完结":
            current_order_status = "已完结"
        
        cursor.execute("""
            UPDATE orders SET 状态 = ?
            WHERE 生产单号=? AND 商家编码=? AND 规格名称=? AND 产品批次号=?
        """, (current_order_status, entry.production_order, entry.merchant_code, entry.spec_name, entry.batch_number))
        
        # E. 更新 qa_flow 中所有该单据记录的状态 (历史同步)
        cursor.execute("""
            UPDATE qa_flow SET 生产单状态 = ? 
            WHERE 生产单号=? AND 商家编码=? AND 规格名称=? AND 产品批次号=?
        """, (current_order_status, entry.production_order, entry.merchant_code, entry.spec_name, entry.batch_number))


        # F. 判断并更新 产品批次状态 (所有该批次下的单据都完结才是完结)
        cursor.execute("""
            SELECT COUNT(*) FROM orders 
            WHERE 产品批次号=? AND (状态 IS NULL OR 状态 != '已完结')
        """, (entry.batch_number,))
        unfinished_count = cursor.fetchone()[0]
        
        batch_status = "已完结" if unfinished_count == 0 else "进行中"
        
        # 更新该批次下所有记录的批次状态
        cursor.execute("""
            UPDATE orders SET 产品批次状态 = ? WHERE 产品批次号=?
        """, (batch_status, entry.batch_number))
        
        cursor.execute("UPDATE qa_flow SET 产品批次状态 = ? WHERE 产品批次号 = ?", (batch_status, entry.batch_number))

        # 【新增】同步更新 orders 表的 '状态'
        cursor.execute("UPDATE orders SET 状态 = ? WHERE 生产单号 = ?", (current_order_status, entry.production_order))

        db.commit()
        return {
            "message": "QA entry created successfully",  
            "order_status": current_order_status, 
            "batch_status": batch_status,
            "progress": f"{total_qualified}/{planned_qty}"
        }
    except Exception as e:
        db.rollback()
        print(f"[ERROR] POST /qa/entry: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/pkg/entry")
def create_pkg_entry(entry: PKGEntry, db: sqlite3.Connection = Depends(get_db)):
    try:
        cursor = db.cursor()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Get price info
        price_df = pd.read_sql(f"SELECT * FROM prices WHERE 商家编码 = '{entry.merchant_code}'", db)
        single_pkg_fee = price_df['只包装工价'].iloc[0] if not price_df.empty else 0
        cut_pkg_fee = price_df['剪包工价'].iloc[0] if not price_df.empty else 0
        
        # 确保价格不为 None，避免乘法运算错误
        single_pkg_fee = single_pkg_fee if pd.notna(single_pkg_fee) else 0
        cut_pkg_fee = cut_pkg_fee if pd.notna(cut_pkg_fee) else 0

        # 优先使用前端传递的执行单价和结算金额，否则根据类型计算
        if entry.unit_price is not None:
            unit_price = entry.unit_price
        else:
            # 兼容 "只包装工价" 和 "只包装" 两种类型名称
            unit_price = single_pkg_fee if entry.type in ["只包装", "只包装工价"] else cut_pkg_fee
        
        if entry.settlement_amount is not None:
            settlement_amount = entry.settlement_amount
        else:
            settlement_amount = entry.quantity * unit_price

        cursor.execute("""
            INSERT INTO pkg_flow (包装工, 类型, 数量, 录入时间, 操作时间, 只包装工价, 剪包工价, 商家编码, 货品名称, 规格名称, 执行单价, 结算金额, 操作员)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            entry.worker, entry.type, entry.quantity, now, now,
            single_pkg_fee, cut_pkg_fee, entry.merchant_code,
            entry.product_name, entry.spec_name, unit_price, settlement_amount, entry.operator
        ))

        db.commit()
        return {"message": "PKG entry created successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/qa/history")
def get_qa_history(db: sqlite3.Connection = Depends(get_db)):
    try:
        # 修改为关联查询，获取最新的生产单状态
        query = """
        SELECT q.*, o.状态 as 生产单状态
        FROM qa_flow q
        LEFT JOIN orders o ON q.生产单号 = o.生产单号
        ORDER BY q.录入时间 DESC
        """
        qa_df = pd.read_sql(query, db)
        if qa_df.empty:
            return []
        qa_df = qa_df.where(pd.notna(qa_df), None)
        return qa_df.to_dict('records')
    except Exception as e:
        print(f"[ERROR] GET /qa/history: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"[ERROR] GET /qa/history: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pkg/history")
def get_pkg_history(db: sqlite3.Connection = Depends(get_db)):
    try:
        pkg_df = pd.read_sql("SELECT * FROM pkg_flow ORDER BY 录入时间 DESC", db)
        if pkg_df.empty:
            return JSONResponse(content=[])
        
        # 使用pandas的to_json来处理NaN值，然后直接返回Response
        json_str = pkg_df.to_json(orient='records', force_ascii=False)
        from fastapi.responses import Response
        return Response(content=json_str, media_type="application/json")
    except Exception as e:
        print(f"[ERROR] GET /pkg/history: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/workers")
def get_workers(db: sqlite3.Connection = Depends(get_db)):
    try:
        workers_df = pd.read_sql("SELECT * FROM workers", db)
        return workers_df.to_dict('records') if not workers_df.empty else []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/prices")
def get_prices(db: sqlite3.Connection = Depends(get_db)):
    try:
        prices_df = pd.read_sql("SELECT * FROM prices", db)
        if prices_df.empty:
            return []
        
        # 处理 NaN 值，将其转换为 None (JSON null)
        # 1. 替换 numpy 的 NaN
        import numpy as np
        prices_df = prices_df.replace({np.nan: None})
        
        # 2. 如果还有，使用 where
        prices_df = prices_df.where(pd.notnull(prices_df), None)
        
        return prices_df.to_dict('records')
    except Exception as e:
        print(f"[ERROR] GET /prices: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# 获取订单列表
@app.get("/orders")
def get_orders(db: sqlite3.Connection = Depends(get_db)):
    try:
        orders_df = pd.read_sql("SELECT * FROM orders", db)
        if orders_df.empty:
            return []
        orders_df = orders_df.where(pd.notna(orders_df), None)
        return orders_df.to_dict('records')
    except Exception as e:
        print(f"[ERROR] GET /orders: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 按批次号搜索订单
@app.get("/orders/search")
def search_orders(batch_number: str = "", db: sqlite3.Connection = Depends(get_db)):
    try:
        if batch_number:
            orders_df = pd.read_sql(f"SELECT * FROM orders WHERE 产品批次号 LIKE '%{batch_number}%'", db)
        else:
            orders_df = pd.read_sql("SELECT * FROM orders", db)
        return orders_df.to_dict('records') if not orders_df.empty else []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 上传Excel文件同步数据
@app.post("/import/excel")
async def import_excel(file: UploadFile = File(...), db: sqlite3.Connection = Depends(get_db)):
    try:
        contents = await file.read()
        
        # 读取Excel文件
        excel_file = io.BytesIO(contents)
        
        # 尝试读取订单和价格表
        try:
            df_ord = pd.read_excel(excel_file, sheet_name=0)
            excel_file.seek(0)  # 重置文件指针
            df_pri = pd.read_excel(excel_file, sheet_name=1)
            
            # 清洗列名空格
            df_ord.columns = df_ord.columns.str.strip()
            df_pri.columns = df_pri.columns.str.strip()
            
            # 写入数据库
            df_ord.to_sql('orders', db, if_exists='replace', index=False)
            df_pri.to_sql('prices', db, if_exists='replace', index=False)
            
            return {
                "message": "Excel数据同步成功",
                "orders_count": len(df_ord),
                "prices_count": len(df_pri)
            }
        except Exception as sheet_error:
            # 如果只有一个sheet，尝试根据文件名判断类型
            excel_file.seek(0)
            df = pd.read_excel(excel_file, sheet_name=0)
            df.columns = df.columns.str.strip()
            
            # 根据列名判断类型
            if '商家编码' in df.columns and '加工点工价' in df.columns:
                df.to_sql('prices', db, if_exists='replace', index=False)
                return {"message": "价格表导入成功", "prices_count": len(df)}
            elif '生产单号' in df.columns or '产品批次号' in df.columns:
                df.to_sql('orders', db, if_exists='replace', index=False)
                return {"message": "订单数据导入成功", "orders_count": len(df)}
            else:
                raise HTTPException(status_code=400, detail="无法识别Excel文件格式")
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 添加工人
@app.post("/workers")
def add_worker(worker: WorkerEntry, db: sqlite3.Connection = Depends(get_db)):
    try:
        cursor = db.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO workers (工号, 姓名, 手机号) VALUES (?, ?, ?)",
            (worker.worker_id, worker.name, worker.phone)
        )
        db.commit()
        return {"message": f"工人 {worker.name} 档案保存成功"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# 删除工人
@app.delete("/workers/{worker_id}")
def delete_worker(worker_id: str, db: sqlite3.Connection = Depends(get_db)):
    try:
        cursor = db.cursor()
        cursor.execute("DELETE FROM workers WHERE 工号 = ?", (worker_id,))
        db.commit()
        return {"message": "工人删除成功"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# 获取质检日志
@app.get("/qa/log")
def get_qa_log(db: sqlite3.Connection = Depends(get_db)):
    try:
        log_df = pd.read_sql("SELECT * FROM qa_log ORDER BY 时间 DESC LIMIT 100", db)
        return log_df.to_dict('records') if not log_df.empty else []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 移动到最后：挂载前端静态文件 (如果存在 'dist' 目录)
# 必须放在所有 API 路由之后，否则会拦截 API 请求导致 405 Method Not Allowed
static_dir = os.path.join(os.path.dirname(__file__), "figmaui", "dist")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    # 初始化数据库 (调用统一的建表逻辑)
    print("Initialize database...")
    try:
        conn = database.init_db()  # 使用 database.py 中的 init_db
        cursor = conn.cursor()
        
        # 1. 自动清理无效数据 (合格与不合格都为0)
        try:
            cursor.execute("DELETE FROM qa_flow WHERE 合格数量 = 0 AND 不合格数量 = 0")
            print(f"已自动清理 {cursor.rowcount} 条无效质检记录")
            conn.commit()
        except Exception as e:
            print(f"清理无效数据警告: {e}")

        # 2. 补丁：确保列存在 (双重保险，虽然init_db里可能已经定义了)
        for table in ['qa_flow', 'pkg_flow', 'qa_log']:
            try:
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN 操作员 TEXT")
            except:
                pass 
        
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN name TEXT")
        except:
            pass

        # 3. 初始化默认用户
        cursor.execute("SELECT count(*) FROM users")
        if cursor.fetchone()[0] == 0:
            default_users = [
                ('admin', 'admin123', 'admin', '系统管理员'),
                ('qa01', '123456', 'qa', '质检员张三'),
                ('pkg01', '123456', 'pkg', '包装员李四')
            ]
            cursor.executemany("INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?)", default_users)
            conn.commit()
            print("已创建默认用户: admin, qa01, pkg01")
        
        conn.close()
    except Exception as e:
        print(f"Database initialization failed: {e}")
    
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)