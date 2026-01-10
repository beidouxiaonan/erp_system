import streamlit as st
import pandas as pd
from datetime import datetime
import time

def render(conn):
    # 增强批次状态和信息卡片的视觉样式
    st.markdown("""
        <style>
        .batch-finished { color: #ffffff; background-color: #28a745; font-weight: bold; padding: 4px 12px; border-radius: 4px; display: inline-block; }
        .batch-pending { color: #ffffff; background-color: #f39c12; font-weight: bold; padding: 4px 12px; border-radius: 4px; display: inline-block; }
        .info-card { background-color: #f8f9fa; padding: 15px; border-radius: 10px; border: 1px solid #dee2e6; margin-bottom: 20px; }
        </style>
    """, unsafe_allow_html=True)

    st.header("🔍 质检入库记录")

    # 审计日志写入函数
    def write_qa_log(order_no, sku, event, detail):
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn.execute("INSERT INTO qa_log (时间, 生产单号, 商家编码, 事件, 操作详情) VALUES (?,?,?,?,?)",
                     (now, order_no, sku, event, detail))
        conn.commit()

    try:
        # 1. 加载数据并强制标准化列名为大写 (解决 ID 报错关键点)
        ord_data = pd.read_sql("SELECT * FROM orders", conn)
        price_data = pd.read_sql("SELECT * FROM prices", conn)
        qa_history_all = pd.read_sql("SELECT * FROM qa_flow ORDER BY 操作时间 DESC", conn)
        
        for df in [qa_history_all, ord_data, price_data]:
            df.columns = [c.upper() for c in df.columns]

        # 清洗商家编码空格
        price_data['商家编码'] = price_data['商家编码'].astype(str).str.strip()
        ord_data['商家编码'] = ord_data['商家编码'].astype(str).str.strip()

        # 2. 搜索控制台：按产品批次号进行三级联动搜索
        with st.expander("🛠️ 搜索与筛选控制台", expanded=True):
            c_input, c_btn = st.columns([4, 1], vertical_alignment="bottom")
            with c_input:
                search_key = st.text_input("请输入产品批次号", placeholder="例如：25123001...")
            with c_btn:
                search_btn = st.button("🔍 执行搜索", use_container_width=True, type="primary")

        if search_key or search_btn:
            # 第一级：通过产品批次号筛选订单
            matched_batch = ord_data[ord_data['产品批次号'].astype(str).str.contains(search_key, case=False)]
            
            if not matched_batch.empty:
                st.markdown("---")
                # 第二级与第三级联动
                col_sel1, col_sel2 = st.columns(2)
                order_list = matched_batch['生产单号'].unique().tolist()
                order_no = col_sel1.selectbox("📌 关联生产单号", order_list)
                
                # 【已修复】：确保使用 matched_batch 变量，避免 undefined 错误
                target_skus = matched_batch[matched_batch['生产单号'] == order_no]
                sku_choice = col_sel2.selectbox("📦 关联商家编码", target_skus['商家编码'].unique().tolist())
                
                # 反查详细信息
                current_row = target_skus[target_skus['商家编码'] == sku_choice].iloc[0]
                batch_no = current_row.get('产品批次号', '未知批次')
                
                # --- 批次完结逻辑判断 ---
                # 筛选属于该批次号的所有单据
                all_batch_tasks = ord_data[ord_data['产品批次号'] == batch_no]
                is_batch_all_done = (all_batch_tasks['状态'] == '已完结').all()
                batch_label = "已完结" if is_batch_all_done else "进行中"
                batch_css = "batch-finished" if is_batch_all_done else "batch-pending"

                # 显示批次状态卡片
                st.markdown(f"""
                    <div class="info-card">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="font-size: 1.1em;">产品批次号：<b>{batch_no}</b></span><br>
                                <span style="color: #6c757d; font-size: 0.9em;">(包含 {len(all_batch_tasks)} 个关联生产单)</span>
                            </div>
                            <div style="text-align: right;">
                                <span style="font-size: 0.9em; color: #6c757d;">产品批次状态</span><br>
                                <span class="{batch_css}">{batch_label}</span>
                            </div>
                        </div>
                    </div>
                """, unsafe_allow_html=True)

                # 获取规格与计划数
                p_match = price_data[price_data['商家编码'] == str(sku_choice).strip()]
                spec_name = p_match['规格名称'].values[0] if not p_match.empty else "未知规格"
                planned_qty = current_row.get('计划生产次数', 0)
                
                # 统计入库进度
                current_qa_history = qa_history_all[(qa_history_all['生产单号'] == order_no) & (qa_history_all['商家编码'] == sku_choice)]
                past_qty = current_qa_history['合格数量'].sum()
                
                # 3. 本次质检录入
                with st.form("entry_form"):
                    st.subheader("📝 本次质检录入")
                    # 四列布局，包含批次状态显示
                    c_e1, c_e2, c_e3, c_e4 = st.columns([1, 1, 1, 1.2])
                    
                    with c_e1:
                        p_num = st.number_input("合格数量", min_value=0, step=1)
                    with c_e2:
                        f_num = st.number_input("不合格数量", min_value=0, step=1)
                    with c_e3:
                        suggested_idx = 1 if (past_qty + p_num) >= planned_qty else 0
                        status_choice = st.selectbox("更新单据状态", ["进行中", "已完结"], index=suggested_idx)
                    with c_e4:
                        st.markdown("**批次状态预览**")
                        st.markdown(f'<span class="{batch_css}">{batch_label}</span>', unsafe_allow_html=True)

                    if st.form_submit_button("📤 提交数据并写入审计日志", use_container_width=True, type="primary"):
                        op_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        conn.execute("""INSERT INTO qa_flow (生产单号, 录入时间, 操作时间, 合格数量, 不合格数量, 状态, 商家编码, 规格名称, 生产商) 
                                     VALUES (?,?,?,?,?,?,?,?,?)""",
                                     (order_no, datetime.now().strftime("%Y-%m-%d"), op_time, p_num, f_num, status_choice, 
                                      sku_choice, spec_name, current_row['生产商']))
                        conn.execute("UPDATE orders SET 状态 = ? WHERE 生产单号 = ? AND 商家编码 = ?", (status_choice, order_no, sku_choice))
                        write_qa_log(order_no, sku_choice, "新增入库", f"入库:{p_num}, 单号状态:{status_choice}")
                        conn.commit()
                        st.success("✅ 提交成功")
                        time.sleep(0.8)
                        st.rerun()

                # 4. 历史记录管理
                st.markdown("### 📜 历史记录管理")
                if not current_qa_history.empty:
                    # 准备编辑器数据
                    edit_df = current_qa_history[['ID', '操作时间', '合格数量', '不合格数量', '状态']].copy()
                    edited_df = st.data_editor(
                        edit_df, 
                        key="qa_manager", 
                        use_container_width=True, 
                        hide_index=True,
                        column_config={
                            "ID": st.column_config.TextColumn("ID", disabled=True),
                            "操作时间": st.column_config.TextColumn("时间", disabled=True),
                            "状态": st.column_config.SelectboxColumn("状态", options=["进行中", "已完结"])
                        }
                    )

                    if st.button("💾 保存修改"):
                        for _, row_ed in edited_df.iterrows():
                            row_orig = current_qa_history[current_qa_history['ID'] == row_ed['ID']].iloc[0]
                            if (row_ed['合格数量'] != row_orig['合格数量']) or (row_ed['状态'] != row_orig['状态']):
                                conn.execute("UPDATE qa_flow SET 合格数量=?, 不合格数量=?, 状态=? WHERE ID=?",
                                             (int(row_ed['合格数量']), int(row_ed['不合格数量']), 
                                              row_ed['状态'], int(row_ed['ID'])))
                        conn.commit()
                        st.rerun()

                # 5. 审计流水
                st.markdown("---")
                st.markdown("### 🛡️ 质检操作审计流水")
                log_df = pd.read_sql(f"SELECT 时间, 事件, 操作详情 FROM qa_log WHERE 生产单号 = '{order_no}' ORDER BY 时间 DESC", conn)
                st.dataframe(log_df, use_container_width=True, hide_index=True)

            else:
                st.warning("🔍 未找到匹配的产品批次号。")
    except Exception as e:
        st.error(f"🚫 模块异常: {e}")