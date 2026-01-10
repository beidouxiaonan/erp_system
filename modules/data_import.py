import streamlit as st
import pandas as pd

def render(conn):
    st.header("📂 基础数据录入与导入")
    tab_excel, tab_worker = st.tabs(["📊 Excel数据同步", "👤 工人档案录入"])
    
    with tab_excel:
        file = st.file_uploader("上传 Excel 文件 (包含订单和价格表)", type=["xlsx"])
        if file and st.button("🚀 确认同步Excel数据"):
            try:
                # 读取不同的 Sheet
                df_ord = pd.read_excel(file, sheet_name=0)
                df_pri = pd.read_excel(file, sheet_name=1)
                
                # 清洗列名空格
                df_ord.columns = df_ord.columns.str.strip()
                df_pri.columns = df_pri.columns.str.strip()
                
                # 写入数据库 (replace 模式会重置表)
                df_ord.to_sql('orders', conn, if_exists='replace', index=False)
                df_pri.to_sql('prices', conn, if_exists='replace', index=False)
                
                st.success("✅ Excel数据同步成功！")
            except Exception as e:
                st.error(f"导入失败: {e}")

    with tab_worker:
        st.subheader("新增工人信息")
        with st.form("worker_import_form", clear_on_submit=True):
            col_w1, col_w2, col_w3 = st.columns(3)
            w_id = col_w1.text_input("工号")
            w_name = col_w2.text_input("姓名")
            w_phone = col_w3.text_input("手机号")
            
            if st.form_submit_button("📥 保存工人档案"):
                if w_id and w_name:
                    conn.execute("INSERT OR REPLACE INTO workers (工号, 姓名, 手机号) VALUES (?,?,?)", 
                                 (w_id, w_name, w_phone))
                    conn.commit()
                    st.success(f"工人 {w_name} 档案保存成功！")
                else:
                    st.error("工号和姓名不能为空")
        
        st.markdown("---")
        st.subheader("当前工人名单")
        try:
            workers_list_df = pd.read_sql("SELECT * FROM workers", conn)
            st.dataframe(workers_list_df, use_container_width=True)
        except:
            st.info("暂无工人数据")