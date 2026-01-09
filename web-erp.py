import streamlit as st
import pandas as pd
import sqlite3
from datetime import datetime
import time

# --- 1. 配置与权限 ---
USER_CREDS = {
    "admin": {"pw": "123", "role": "管理员", "menus": ["数据导入", "质检录入", "包装录入", "看板分析"]},
    "staff": {"pw": "456", "role": "录入员", "menus": ["质检录入", "包装录入"]},
    "boss":  {"pw": "789", "role": "看板人员", "menus": ["看板分析"]}
}

def init_db():
    conn = sqlite3.connect('factory_mes_v3.db', check_same_thread=False)
    # 质检流水表
    conn.execute('''CREATE TABLE IF NOT EXISTS qa_flow 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 生产单号 TEXT, 录入时间 TEXT, 合格数量 INTEGER, 
                  不合格数量 INTEGER, 状态 TEXT, 商家编码 TEXT, 生产商 TEXT, 加工点工价 REAL)''')
    # 包装流水表
    conn.execute('''CREATE TABLE IF NOT EXISTS pkg_flow 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 包装工 TEXT, 类型 TEXT, 数量 INTEGER, 录入时间 TEXT, 单价 REAL)''')
    conn.commit()
    return conn

conn = init_db()

# --- 2. 登录逻辑 ---
if 'auth' not in st.session_state:
    st.session_state.auth = {'ok': False, 'role': '', 'user': '', 'menus': []}

def login():
    st.sidebar.title("🔐 登录系统")
    u = st.sidebar.text_input("账号")
    p = st.sidebar.text_input("密码", type="password")
    if st.sidebar.button("登录"):
        if u in USER_CREDS and USER_CREDS[u]["pw"] == p:
            st.session_state.auth.update({'ok': True, 'role': USER_CREDS[u]["role"], 'user': u, 'menus': USER_CREDS[u]["menus"]})
            st.rerun()
        else: st.sidebar.error("密码错误")

# --- 3. 主界面设置 ---
st.set_page_config(page_title="工厂MES管理系统", layout="wide")

if not st.session_state.auth['ok']:
    st.title("🏭 生产管理 Web 局域网系统")
    login()
else:
    st.sidebar.success(f"当前用户: {st.session_state.auth['user']} ({st.session_state.auth['role']})")
    if st.sidebar.button("退出系统"):
        st.session_state.auth['ok'] = False
        st.rerun()
    
    choice = st.sidebar.radio("菜单导航", st.session_state.auth['menus'])

    # --- 模块 A: 数据导入 (带进度条) ---
    if choice == "数据导入":
        st.header("📂 基础资料导入")
        file = st.file_uploader("请上传包含 orders 和 prices 的 Excel 文件", type=["xlsx"])
        
        if file:
            try:
                with st.spinner('正在解析 Excel 文件...'):
                    df_ord = pd.read_excel(file, sheet_name=0)
                    df_pri = pd.read_excel(file, sheet_name=1)
                
                st.subheader("数据预览")
                st.dataframe(df_ord.head(3))
                
                if st.button("🚀 确认同步至数据库"):
                    progress_bar = st.progress(0)
                    status_text = st.empty()
                    
                    # 清理旧表
                    conn.execute("DROP TABLE IF EXISTS orders")
                    conn.execute("DROP TABLE IF EXISTS prices")
                    conn.commit()

                    def batch_import(df, table_name, start_val, end_val):
                        total_rows = len(df)
                        chunk_size = 50 
                        for i in range(0, total_rows, chunk_size):
                            chunk = df.iloc[i : i + chunk_size]
                            chunk.to_sql(table_name, conn, if_exists='append', index=False)
                            percent = start_val + (i / total_rows) * (end_val - start_val)
                            progress_bar.progress(min(percent, 1.0))
                            status_text.text(f"正在导入 {table_name}: {min(i+chunk_size, total_rows)}/{total_rows}")
                            time.sleep(0.01)

                    batch_import(df_ord, 'orders', 0.0, 0.7)
                    batch_import(df_pri, 'prices', 0.7, 1.0)
                    
                    progress_bar.progress(1.0)
                    status_text.success("✅ 数据库同步完成！")
                    st.balloons()
            except Exception as e:
                st.error(f"导入失败: {e}")

    # --- 模块 B: 质检录入 (带搜索按钮) ---
    elif choice == "质检录入":
        st.header("🔍 质检入库记录")
        try:
            query = "SELECT * FROM orders WHERE 状态 != '已完结'"
            ord_data = pd.read_sql(query, conn)
            price_data = pd.read_sql("SELECT 商家编码, 加工点工价 FROM prices", conn)
            
            # 搜索栏布局
            c_input, c_btn = st.columns([4, 1])
            with c_input:
                key = st.text_input("输入关键词（单号/生产商/编码）", placeholder="请输入搜索内容...")
            with c_btn:
                st.write("##")
                search_btn = st.button("🔍 开始搜索", use_container_width=True)

            # 触发搜索逻辑
            if key or search_btn:
                res = ord_data[ord_data.astype(str).apply(lambda x: key.lower() in x.str.lower().values, axis=1)]
                
                if not res.empty:
                    st.divider()
                    idx = st.selectbox("请在搜索结果中选择单据", res.index, 
                                       format_func=lambda x: f"{res.loc[x,'生产单号']} | {res.loc[x,'生产商']} | {res.loc[x,'商家编码']}")
                    
                    row = res.loc[idx]
                    matching_price = price_data[price_data['商家编码'] == row['商家编码']]['加工点工价'].values
                    unit_price = matching_price[0] if len(matching_price) > 0 else 0
                    
                    with st.container(border=True):
                        st.subheader(f"📝 录入单据：{row['生产单号']}")
                        st.info(f"对应生产商：{row['生产商']} | 商家编码：{row['商家编码']} | 加工单价：{unit_price}")
                        col1, col2, col3 = st.columns(3)
                        p_num = col1.number_input("合格数量", 0)
                        f_num = col2.number_input("不合格数量", 0)
                        is_end = col3.selectbox("单据状态更新", ["生产中", "已完结"])
                        
                        if st.button("📤 提交并保存数据", type="primary", use_container_width=True):
                            now = datetime.now().strftime("%Y-%m-%d %H:%M")
                            conn.execute("""INSERT INTO qa_flow (生产单号, 录入时间, 合格数量, 不合格数量, 状态, 商家编码, 生产商, 加工点工价) 
                                         VALUES (?,?,?,?,?,?,?,?)""",
                                         (row['生产单号'], now, p_num, f_num, is_end, row['商家编码'], row['生产商'], unit_price))
                            conn.execute("UPDATE orders SET 状态 = ? WHERE 生产单号 = ?", (is_end, row['生产单号']))
                            conn.commit()
                            st.success(f"单号 {row['生产单号']} 录入成功！")
                            time.sleep(1)
                            st.rerun()
                else:
                    st.warning("未搜索到相关匹配数据。")
            else:
                st.info("💡 请输入关键词并点击搜索按钮开始。")
        except:
            st.warning("请检查数据导入情况，确保基础信息完整。")

    # --- 模块 C: 包装录入 ---
    elif choice == "包装录入":
        st.header("📦 包装/剪包工效录入")
        try:
            price_list = pd.read_sql("SELECT * FROM prices", conn)
            with st.form("pkg_form"):
                worker = st.text_input("包装工姓名")
                spec = st.selectbox("选择货品规格", price_list['规格名称'].unique())
                pkg_type = st.radio("计费类型", ["只包装工价", "剪包工价"])
                qty = st.number_input("包装数量", 1)
                if st.form_submit_button("确认保存"):
                    u_price = price_list[price_list['规格名称']==spec][pkg_type].values[0]
                    now = datetime.now().strftime("%Y-%m-%d %H:%M")
                    conn.execute("INSERT INTO pkg_flow (包装工, 类型, 数量, 录入时间, 单价) VALUES (?,?,?,?,?)",
                                 (worker, pkg_type, qty, now, u_price))
                    conn.commit()
                    st.success(f"已录入：{worker} | 单价：{u_price}")
        except:
            st.warning("价格表缺失，请先导入数据。")

    # --- 模块 D: 看板分析 ---
    elif choice == "看板分析":
        st.header("📊 生产综合看板")
        qa_df = pd.read_sql("SELECT * FROM qa_flow", conn)
        pkg_df = pd.read_sql("SELECT * FROM pkg_flow", conn)
        
        tab1, tab2 = st.tabs(["加工点对账", "包装对账"])
        with tab1:
            if not qa_df.empty:
                qa_df['加工总金额'] = qa_df['合格数量'] * qa_df['加工点工价']
                st.dataframe(qa_df, use_container_width=True)
                summary = qa_df.groupby('生产商').agg({'合格数量':'sum', '加工总金额':'sum'}).reset_index()
                st.table(summary)
            else: st.info("暂无数据")

        with tab2:
            if not pkg_df.empty:
                pkg_df['实发工资'] = pkg_df['数量'] * pkg_df['单价']
                st.dataframe(pkg_df, use_container_width=True)
                worker_sum = pkg_df.groupby('包装工').agg({'数量':'sum', '实发工资':'sum'}).reset_index()
                st.dataframe(worker_sum)
                csv = pkg_df.to_csv(index=False).encode('utf-8-sig')
                st.download_button("导出 CSV 报表", csv, "salary_report.csv", "text/csv")