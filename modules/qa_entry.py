import streamlit as st
import pandas as pd
from datetime import datetime
import time

def render(conn):
    # 增强批次状态和进度条的视觉样式
    st.markdown("""
        <style>
        .batch-finished { color: #ffffff; background-color: #28a745; font-weight: bold; padding: 4px 12px; border-radius: 4px; display: inline-block; }
        .batch-pending { color: #ffffff; background-color: #f39c12; font-weight: bold; padding: 4px 12px; border-radius: 4px; display: inline-block; }
        .info-card { background-color: #f8f9fa; padding: 15px; border-radius: 10px; border: 1px solid #dee2e6; margin-bottom: 10px; }
        .metric-box { background-color: #ffffff; padding: 10px; border-radius: 5px; border: 1px dashed #ccc; text-align: center; }
        </style>
    """, unsafe_allow_html=True)

    st.header("🔍 质检入库记录")

    def write_qa_log(order_no, sku, event, detail):
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn.execute("INSERT INTO qa_log (时间, 生产单号, 商家编码, 事件, 操作详情) VALUES (?,?,?,?,?)",
                     (now, order_no, sku, event, detail))
        conn.commit()

    try:
        # 1. 加载数据并标准化
        ord_data = pd.read_sql("SELECT * FROM orders", conn)
        price_data = pd.read_sql("SELECT * FROM prices", conn)
        # 确保按时间倒序，方便取最新状态
        qa_history_all = pd.read_sql("SELECT * FROM qa_flow ORDER BY 操作时间 DESC", conn)
        
        for df in [qa_history_all, ord_data, price_data]:
            df.columns = [c.upper() for c in df.columns]

        price_data['商家编码'] = price_data['商家编码'].astype(str).str.strip()
        ord_data['商家编码'] = ord_data['商家编码'].astype(str).str.strip()

        # 2. 搜索控制台：按产品批次号搜索
        with st.expander("🛠️ 搜索与筛选控制台", expanded=True):
            c_input, c_btn = st.columns([4, 1], vertical_alignment="bottom")
            with c_input:
                search_key = st.text_input("请输入产品批次号进行搜索", placeholder="输入批次号...")
            with c_btn:
                search_btn = st.button("🔍 执行搜索", use_container_width=True, type="primary")

        if search_key or search_btn:
            matched_batch = ord_data[ord_data['产品批次号'].astype(str).str.contains(search_key, case=False)]
            
            if not matched_batch.empty:
                # 级联选择：单号 -> 编码 -> 规格 (修复级联逻辑)
                col_sel1, col_sel2, col_sel3 = st.columns(3)
                
                # 1. 选择生产单号
                order_list = matched_batch['生产单号'].unique().tolist()
                order_no = col_sel1.selectbox("📌 选择关联生产单号", order_list) 
                
                # 获取该单号下的所有数据
                target_skus = matched_batch[matched_batch['生产单号'] == order_no]
                
                # 2. 选择商家编码 (从该单号的数据中选)
                sku_choice = col_sel2.selectbox("📦 选择关联商家编码", target_skus['商家编码'].unique().tolist())
                
                # 3. 选择规格名称 (核心修改：先根据选中的 SKU 过滤数据，再显示对应的规格)
                # 这样就实现了一对一的级联，规格下拉框里只会有一个对应的选项
                specific_sku_data = target_skus[target_skus['商家编码'] == sku_choice]
                spec_name = col_sel3.selectbox("📦 选择关联规格名称", specific_sku_data['规格名称'].unique().tolist())
                
                # 获取基础数据 (直接使用过滤后的特定数据，无需再次查找)
                # 注意：这里加了 .iloc[0] 是因为经过层层筛选，理论上只剩下一行数据
                if not specific_sku_data.empty:
                    current_row = specific_sku_data.iloc[0]
                    batch_no = current_row.get('产品批次号', '未知批次')
                else:
                    st.error("数据匹配异常，未找到对应规格信息")
                    st.stop()
                
                # =========================================================
                # --- A. 整体批次状态计算 (核心修正逻辑) ---
                # =========================================================
                # 1. 从 orders 表获取该批次下所有的具体任务 (生产单号 + 商家编码 的唯一组合)
                # 这是批次完结的“基准范围”
                all_tasks_in_batch = ord_data[ord_data['产品批次号'] == batch_no]
                
                # 2. 遍历检查每一个具体任务在 qa_flow 中的最新状态
                is_batch_all_done = True
                
                if all_tasks_in_batch.empty:
                    is_batch_all_done = False
                else:
                    for _, task_row in all_tasks_in_batch.iterrows():
                        t_order = task_row['生产单号']
                        t_sku = task_row['商家编码']
                        
                        # 在历史记录中找到该任务（单号+SKU）的记录
                        t_history = qa_history_all[
                            (qa_history_all['生产单号'] == t_order) & 
                            (qa_history_all['商家编码'] == t_sku)
                        ]
                        
                        if t_history.empty:
                            # 如果某个任务连一条质检记录都没有，说明肯定没完结
                            is_batch_all_done = False
                            break
                        
                        # 取最新一条记录的状态
                        latest_status = t_history.iloc[0].get('生产单状态', '')
                        if latest_status != '已完结':
                            # 只要有一个任务不是已完结，整个批次就是进行中
                            is_batch_all_done = False
                            break
                
                batch_label = "已完结" if is_batch_all_done else "进行中"
                batch_css = "batch-finished" if is_batch_all_done else "batch-pending"

                st.markdown(f"""
                    <div class="info-card">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="font-size: 1.1em;">产品批次号：<b>{batch_no}</b></span><br>
                                <span style="color: #6c757d; font-size: 0.9em;">(该批次共包含 {len(all_tasks_in_batch)} 个具体生产任务)</span>
                            </div>
                            <div style="text-align: right;">
                                <span style="font-size: 0.8em; color: #6c757d;">产品批次全局状态</span><br>
                                <span class="{batch_css}">{batch_label}</span>
                            </div>
                        </div>
                    </div>
                """, unsafe_allow_html=True)

                # --- B. 生产进度计算逻辑 ---
                p_match = price_data[price_data['商家编码'] == str(sku_choice).strip()]
                spec_name = p_match['规格名称'].values[0] if not p_match.empty else "未知规格"
                
                # 计划数与已入库数
                planned_qty = current_row.get('计划生产次数', 0)
                current_qa_history = qa_history_all[(qa_history_all['生产单号'] == order_no) & (qa_history_all['商家编码'] == sku_choice)]
                past_qty = current_qa_history['合格数量'].sum()
                
                # 计算百分比
                progress_val = min(1.0, past_qty / planned_qty) if planned_qty > 0 else 0
                
                # 进度条展示区
                st.markdown("##### 📈 单个单号生产进度")
                st.progress(progress_val, text=f"完成率: {int(progress_val*100)}% (计划: {planned_qty} / 已入库: {past_qty})")
                
                m1, m2, m3 = st.columns(3)
                m1.markdown(f'<div class="metric-box"><small>单号已合格</small><br><b style="color:#28a745;font-size:1.2em;">{past_qty}</b></div>', unsafe_allow_html=True)
                m2.markdown(f'<div class="metric-box"><small>单号待产余量</small><br><b style="color:#dc3545;font-size:1.2em;">{max(0, planned_qty - past_qty)}</b></div>', unsafe_allow_html=True)
                m3.markdown(f'<div class="metric-box"><small>规格名称</small><br><b>{spec_name}</b></div>', unsafe_allow_html=True)

                st.markdown("---")

                # 3. 本次质检录入表单
                # 修改：添加 clear_on_submit=True，确保提交后输入框清空，下拉框重置
                with st.form("entry_form", clear_on_submit=True):
                    st.subheader("📝 本次质检录入")
                    c_e1, c_e2, c_e3, c_e4 = st.columns([1, 1, 1, 1.2])
                    
                    with c_e1:
                        p_num = st.number_input("合格数量", min_value=0, step=1)
                    with c_e2:
                        f_num = st.number_input("不合格数量", min_value=0, step=1)
                    with c_e3:
                        # 智能建议：如果加上本次录入量达到计划数，默认建议“已完结”
                        # 注意：表单重置后，这里会重新计算默认值。如果订单已满，它会自动默认为“已完结”，这是正常逻辑。
                        suggested_idx = 1 if (past_qty + p_num) >= planned_qty else 0
                        status_choice = st.selectbox("更新生产单据状态", ["进行中", "已完结"], index=suggested_idx)
                    with c_e4:
                        st.markdown("**批次状态预览**")
                        st.markdown(f'<span class="{batch_css}">{batch_label}</span>', unsafe_allow_html=True)

                    if st.form_submit_button("📤 提交数据并写入审计日志(合格与不合格数量同时为0时，提交不会改变批次状态)", use_container_width=True, type="primary"):
                        # =====================================================
                        # --- 提交时的状态预判 (核心修正逻辑 Part 2) ---
                        # =====================================================
                        # 逻辑：预判当【当前单号+SKU】更新为用户选择的状态后，整个批次是否会完结
                        
                        all_tasks_finished_after_update = True
                        
                        # 遍历该批次下的所有任务
                        for _, task_row in all_tasks_in_batch.iterrows():
                            t_order = task_row['生产单号']
                            t_sku = task_row['商家编码']
                            
                            # 情况1：如果是当前正在操作的单子，直接检查用户选的状态
                            if t_order == order_no and t_sku == sku_choice:
                                if status_choice != '已完结':
                                    all_tasks_finished_after_update = False
                                    break
                                continue # 继续检查下一个
                            
                            # 情况2：如果是其他单子，查历史流水
                            t_hist = qa_history_all[
                                (qa_history_all['生产单号'] == t_order) & 
                                (qa_history_all['商家编码'] == t_sku)
                            ]
                            
                            if t_hist.empty:
                                all_tasks_finished_after_update = False # 其他单子还没开始
                                break
                            
                            if t_hist.iloc[0]['生产单状态'] != '已完结':
                                all_tasks_finished_after_update = False # 其他单子还没完
                                break
                        
                        new_batch_status = '已完结' if all_tasks_finished_after_update else '进行中'
                            
                        # =====================================================

                        ord_data_raw = pd.read_sql("SELECT * FROM orders", conn)
                        batch_no_row = ord_data_raw[(ord_data_raw['生产单号'] == order_no) & (ord_data_raw['商家编码'] == sku_choice)]['产品批次号'].values[0]
                        op_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        
                        # 写入 qa_flow，注意这里的 产品批次状态 使用的是计算出的 new_batch_status
                        conn.execute("""INSERT INTO qa_flow (生产单号, 录入时间, 操作时间, 产品批次号, 产品批次状态, 合格数量, 不合格数量, 
                                     生产单状态, 商家编码, 规格名称, 生产商, 加工点工价, 结算金额) 
                                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                                     (order_no, datetime.now().strftime("%Y-%m-%d"), op_time, str(batch_no_row).strip(), new_batch_status,
                                      p_num, f_num, status_choice,
                                      sku_choice, spec_name, current_row['生产商'], p_match['加工点工价'].values[0] if not p_match.empty else 0 ,
                                      p_num * (p_match['加工点工价'].values[0] if not p_match.empty else 0)))
                        safe_batch_no = str(batch_no_row).strip()
                        conn.execute("UPDATE qa_flow SET 产品批次状态=? WHERE 产品批次号=?", (new_batch_status, safe_batch_no))
                        conn.commit()
                        # 写入质检日志
                        write_qa_log(order_no, sku_choice, "新增入库", f"入库:{p_num}, 单状态:{status_choice}, 批次:{new_batch_status}")
                        conn.commit()
                        st.success(f"✅ 数据已录入，批次状态更新为: {new_batch_status}")
                        conn.execute("DELETE FROM qa_flow WHERE 产品批次号=? AND 合格数量=0 AND 不合格数量=0", (safe_batch_no,))
                        conn.commit()    
                        time.sleep(0.8)
                        st.rerun()

                # =========================================================
                # 4. 历史记录管理 (修正版：修复变量作用域报错 + 自动重算批次状态)
                # =========================================================
                st.markdown("### 📜 历史记录管理")
                if not current_qa_history.empty:
                    # 准备编辑数据
                    edit_df = current_qa_history[['ID', '操作时间', '合格数量', '不合格数量', '生产单状态']].copy()
                    
                    edited_df = st.data_editor(
                        edit_df, 
                        key="qa_manager", 
                        use_container_width=True, 
                        hide_index=True,
                        column_config={
                            "ID": st.column_config.TextColumn("ID", disabled=True),
                            "操作时间": st.column_config.TextColumn("录入时间", disabled=True),
                            "生产单状态": st.column_config.SelectboxColumn("生产单状态", options=["进行中", "已完结"])
                        }
                    )
                    
                    if st.button("💾 保存表格中的修改"):
                        # --- 1. 执行行更新 ---
                        for _, row_ed in edited_df.iterrows():
                            # 获取原始数据进行比对
                            row_orig = current_qa_history[current_qa_history['ID'] == row_ed['ID']].iloc[0]
                            
                            # 只有数据变动时才更新
                            if (row_ed['合格数量'] != row_orig['合格数量']) or (row_ed['生产单状态'] != row_orig['生产单状态']):
                                conn.execute(
                                    "UPDATE qa_flow SET 合格数量=?, 不合格数量=?, 生产单状态=? WHERE ID=?",
                                    (int(row_ed['合格数量']), int(row_ed['不合格数量']), row_ed['生产单状态'], int(row_ed['ID']))
                                )
                        conn.commit()
                        
                        # --- 2. 重新计算并更新整个批次的状态 (Fix: 解决变量未定义报错) ---
                        # 获取该批次下的所有任务基准
                        all_tasks_check = pd.read_sql(
                            f"SELECT 生产单号, 商家编码 FROM orders WHERE 产品批次号 = '{batch_no}'", conn
                        )
                        
                        is_recalc_finished = True
                        if all_tasks_check.empty:
                            is_recalc_finished = False
                        else:
                            for _, t_row in all_tasks_check.iterrows():
                                # 查询每个任务在 qa_flow 中的 *最新* 状态 (查询刚更新过的数据库)
                                sql_check = f"""
                                    SELECT 生产单状态 FROM qa_flow 
                                    WHERE 生产单号='{t_row['生产单号']}' AND 商家编码='{t_row['商家编码']}' 
                                    ORDER BY 操作时间 DESC LIMIT 1
                                """
                                res_status = pd.read_sql(sql_check, conn)
                                
                                if res_status.empty or res_status.iloc[0]['生产单状态'] != '已完结':
                                    is_recalc_finished = False
                                    break
                        
                        # 确定新的状态
                        recalc_status = "已完结" if is_recalc_finished else "进行中"
                        safe_batch_str = str(batch_no).strip()
                        
                        # 更新数据库中的批次状态
                        conn.execute(
                            "UPDATE qa_flow SET 产品批次状态=? WHERE 产品批次号=?", 
                            (recalc_status, safe_batch_str)
                        )
                        conn.commit()
                        
                        st.success(f"✅ 修改已保存，该批次当前状态重算为: {recalc_status}")
                        time.sleep(0.8)
                        st.rerun()

                # 5. 审计流水展示
                st.markdown("---")
                st.markdown("### 🛡️ 质检操作审计流水")
                log_df = pd.read_sql(f"SELECT 时间, 事件, 操作详情 FROM qa_log WHERE 生产单号 = '{order_no}' ORDER BY 时间 DESC", conn)
                st.dataframe(log_df, use_container_width=True, hide_index=True)

            else:
                st.warning("🔍 未找到匹配的产品批次号。")

        # ==========================================================
        # 新增部分：QA_FLOW 全局历史明细明细记录 (不依赖搜索)
        # ==========================================================
        st.write("")
        st.markdown("---")
        st.subheader("📋 质检入库历史明细总表")
        
        # 增加一个筛选小工具
        with st.container():
            col_f1, col_f2 = st.columns([2, 2])
            with col_f1:
                filter_batch = st.text_input("筛选批次号", key="filter_batch")
            with col_f2:
                filter_order = st.text_input("筛选生产单号", key="filter_order")

        # 处理数据筛选
        detail_display = qa_history_all.copy()
        if filter_batch:
            detail_display = detail_display[detail_display['产品批次号'].astype(str).str.contains(filter_batch)]
        if filter_order:
            detail_display = detail_display[detail_display['生产单号'].astype(str).str.contains(filter_order)]

        # 整理显示列（包含计算后的结算逻辑）
        display_detail_cols = [
            '操作时间', '产品批次号', '产品批次状态', '生产单号', '商家编码', 
            '规格名称', '合格数量', '不合格数量', '加工点工价', '结算金额'
        ]
        
        # 核心逻辑应用：如果是历史表，直接显示已存入数据库的结算金额
        detail_display['有效结算'] = detail_display.apply(
            lambda x: x['结算金额'] if str(x['产品批次状态']).strip() == '已完结' else 0.0, axis=1
        )

        st.dataframe(
            detail_display[display_detail_cols + ['有效结算']],
            use_container_width=True,
            hide_index=True,
            column_config={
                "操作时间": st.column_config.TextColumn("录入时间"),
                "结算金额": st.column_config.NumberColumn("单笔预计", format="¥%.2f"),
                "有效结算": st.column_config.NumberColumn("当前可结", format="¥%.2f", help="若批次进行中则为0"),
                "合格数量": st.column_config.NumberColumn("合格", format="%d ✅")
            }
        )

    except Exception as e:
        st.error(f"🚫 模块异常: {e}")