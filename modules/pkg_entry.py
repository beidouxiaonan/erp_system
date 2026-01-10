import streamlit as st
import pandas as pd
from datetime import datetime
import time
import io

def render(conn):
    st.header("📦 包装录入管理")
    try:
        # 1. 加载基础信息
        prices = pd.read_sql("SELECT 商家编码, 货品编号, 货品名称, 规格名称, 只包装工价, 剪包工价 FROM prices", conn)
        workers_df = pd.read_sql("SELECT 姓名 FROM workers", conn)
        
        if workers_df.empty:
            st.warning("⚠️ 暂无工人信息。")
            return

        # --- A. 录入表单区域 ---
        with st.container(border=True):
            st.subheader("📝 新增包装记录")
            worker_name = st.selectbox("1. 选择包装工", workers_df['姓名'].tolist())
            
            sku_list = prices['货品编号'].unique().tolist()
            selected_sku = st.selectbox("2. 选择【货品编号】", sku_list, index=None, placeholder="输入编号搜索...")
            
            if selected_sku:
                filtered_rows = prices[prices['货品编号'] == selected_sku]
                item_name = filtered_rows['货品名称'].iloc[0]
                spec_list = filtered_rows['规格名称'].unique().tolist()
                selected_spec = st.selectbox("3. 选择【规格名称】", spec_list)
                
                if selected_spec:
                    final_item = filtered_rows[filtered_rows['规格名称'] == selected_spec].iloc[0]
                    st.info(f"✅ **确认货品：** {item_name} | 规格：{selected_spec}")
                    
                    st.write("---")
                    c1, c2 = st.columns(2)
                    fee_type = c1.radio("4. 计费类型", ["只包装工价", "剪包工价"], horizontal=True)
                    pkg_qty = c2.number_input("5. 包装数量", min_value=1, step=1)
                    
                    if st.button("📤 提交本次包装记录", type="primary", use_container_width=True):
                        unit_fee = final_item[fee_type]
                        op_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        today = datetime.now().strftime("%Y-%m-%d")
                        
                        # 提交逻辑：根据选择，一个存入单价，另一个存0
                        conn.execute("""INSERT INTO pkg_flow 
                                     (包装工, 类型, 数量, 录入时间, 操作时间, 只包装工价, 剪包工价, 商家编码, 货品名称, 规格名称,执行单价, 结算金额) 
                                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""", 
                                     (worker_name, fee_type, pkg_qty, today, op_ts, 
                                      float(unit_fee),
                                      float(unit_fee),
                                      str(selected_sku), item_name, selected_spec, float(unit_fee), float(unit_fee*pkg_qty)))
                        conn.commit()
                        st.success(f"✅ 已成功录入: {item_name}")
                        time.sleep(0.5)
                        st.rerun()

        # --- B. 数据显示表单区域 ---
        st.write("---")
        st.subheader("📋 今日包装录入明细")
        
        # SQL 只查询数据库里确实存在的列
        history_query = """
            SELECT 操作时间, 包装工, 类型, 货品名称, 商家编码, 规格名称, 数量, 只包装工价, 剪包工价,  执行单价, 结算金额
            FROM pkg_flow 
            ORDER BY 操作时间 DESC 
            LIMIT 50
        """
        df = pd.read_sql(history_query, conn)

        if not df.empty:
           
            # 导出功能
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                df.to_excel(writer, index=False)
            st.download_button("📥 导出记录", output.getvalue(), f"PKG_DETAIL_{datetime.now().strftime('%m%d')}.xlsx")

            # 渲染表格：此时 df 已经包含了“执行单价”
            st.dataframe(
                df,
                use_container_width=True,
                hide_index=True,
                column_config={
                    "只包装工价": st.column_config.NumberColumn("只包(参考)", format="%.2f"),
                    "剪包工价": st.column_config.NumberColumn("剪包(参考)", format="%.2f"),
                    "执行单价": st.column_config.NumberColumn("执行单价", format="¥%.2f"),
                    "数量": st.column_config.NumberColumn("数量", format="%d 件")
                }
            )
        else:
            st.info("💡 暂无历史录入数据。")

    except Exception as e:
        st.error(f"发生错误: {e}")