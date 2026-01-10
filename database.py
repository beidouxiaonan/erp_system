import sqlite3

def init_db():
    # 使用 v11 版本号确保数据库结构完全同步
    conn = sqlite3.connect('factory_mes_v11.db', check_same_thread=False)
    
    # 质检流水表 (确保 ID 大写统一)
    conn.execute('''CREATE TABLE IF NOT EXISTS qa_flow 
                 (ID INTEGER PRIMARY KEY AUTOINCREMENT, 生产单号 TEXT, 录入时间 TEXT, 操作时间 TEXT,
                  合格数量 INTEGER, 不合格数量 INTEGER, 状态 TEXT, 商家编码 TEXT, 规格名称 TEXT, 生产商 TEXT, 加工点工价 REAL)''')
    
    # 包装流水表
    conn.execute('''CREATE TABLE IF NOT EXISTS pkg_flow 
                 (ID INTEGER PRIMARY KEY AUTOINCREMENT, 包装工 TEXT, 类型 TEXT, 数量 INTEGER, 
                  录入时间 TEXT, 操作时间 TEXT, 单价 REAL, 商家编码 TEXT, 规格名称 TEXT)''')
    
    # 工人信息表
    conn.execute('''CREATE TABLE IF NOT EXISTS workers 
                 (工号 TEXT PRIMARY KEY, 姓名 TEXT, 手机号 TEXT)''')
    
    # 在 database.py中添加 质检日志表
    conn.execute('''CREATE TABLE IF NOT EXISTS qa_log 
             (ID INTEGER PRIMARY KEY AUTOINCREMENT, 
              时间 TEXT, 
              生产单号 TEXT, 
              商家编码 TEXT, 
              事件 TEXT, 
              操作详情 TEXT)''')

    
    conn.commit()
    return conn