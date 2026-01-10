import streamlit as st
import pandas as pd
from datetime import datetime
import time

def render(conn):
    st.header("📦 包装录入管理")
    try:
        # 加载基础信息
        prices = pd.read_sql("SELECT 商家编码, 货品编号, 货品名称, 规格名称, 只包装工价, 剪包工价 FROM prices", conn)
        workers_df = pd.read_sql("SELECT 姓名 FROM workers", conn)
        
        if workers_df.empty:
            st.warning("⚠️ 暂无工人信息。请先前往“数据导入 -> 工人档案录入”进行录入。")
            return

        with st.container(border=True):
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
                    st.info(f"✅ **确认货品：** {item_name} | 规格：{selected_spec} | 包装工价：{final_item['只包装工价']}")
                    
                    st.write("---")
                    c1, c2 = st.columns(2)
                    fee_type = c1.radio("4. 计费类型", ["只包装工价", "剪包工价"], horizontal=True)
                    pkg_qty = c2.number_input("5. 包装数量", min_value=1, step=1)
                    
                    if st.button("📤 提交本次包装记录", type="primary", use_container_width=True):
                        unit_fee = final_item[fee_type]
                        op_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        today = datetime.now().strftime("%Y-%m-%d")
                        
                        conn.execute("""INSERT INTO pkg_flow 
                                     (包装工, 类型, 数量, 录入时间, 操作时间, 单价, 商家编码, 规格名称) 
                                     VALUES (?,?,?,?,?,?,?,?)""", 
                                     (worker_name, fee_type, pkg_qty, today, 
                                      op_ts, unit_fee, str(selected_sku), selected_spec))
                        conn.commit()
                        st.success(f"✅ 已成功录入: {item_name} - {selected_spec}")
                        time.sleep(0.5)
                        st.rerun()
            else:
                st.write("💡 请先搜索并选择货品编号。")
    except Exception as e:
        st.error(f"发生错误: {e}")