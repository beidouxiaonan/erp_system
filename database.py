import sqlite3

def init_db():
    # 使用 v11 版本号确保数据库结构完全同步
    conn = sqlite3.connect('factory_mes_V1.db', check_same_thread=False)
    
    # 质检流水表 (确保 ID 大写统一)
    conn.execute('''CREATE TABLE IF NOT EXISTS qa_flow 
                 (ID INTEGER PRIMARY KEY AUTOINCREMENT, 生产单号 TEXT, 录入时间 TEXT, 操作时间 TEXT,产品批次号 TEXT,产品批次状态 TEXT,
                  合格数量 INTEGER, 不合格数量 INTEGER, 生产单状态 TEXT, 商家编码 TEXT, 规格名称 TEXT, 生产商 TEXT, 加工点工价 INTEGER, 结算金额 INTEGER)''')
    
    # 包装流水表
    conn.execute('''CREATE TABLE IF NOT EXISTS pkg_flow 
                 (ID INTEGER PRIMARY KEY AUTOINCREMENT, 包装工 TEXT, 类型 TEXT, 数量 INTEGER, 
                  录入时间 TEXT, 操作时间 TEXT,只包装工价 INTEGER, 剪包工价 INTEGER, 商家编码 TEXT, 货品名称 TEXT, 规格名称 TEXT,执行单价 INTEGER, 结算金额 INTEGER)''')
    
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
              操作详情 TEXT,
              操作员 TEXT)''')
              
    # 用户表
    conn.execute('''CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT,
            role TEXT,
            name TEXT
        )''')
    
    # 订单表 (结构由Excel导入决定，但预先创建以防止报错)
    conn.execute('''CREATE TABLE IF NOT EXISTS orders (
            生产单号 TEXT, 
            产品批次号 TEXT, 
            商家编码 TEXT, 
            规格名称 TEXT, 
            生产商 TEXT, 
            计划生产次数 INTEGER, 
            状态 TEXT,
            产品批次状态 TEXT
        )''')
        
    # 价格表
    conn.execute('''CREATE TABLE IF NOT EXISTS prices (
            商家编码 TEXT, 
            货品编号 TEXT, 
            货品名称 TEXT, 
            规格名称 TEXT, 
            加工点工价 REAL, 
            只包装工价 REAL, 
            剪包工价 REAL
        )''')

    
    conn.commit()
    return conn