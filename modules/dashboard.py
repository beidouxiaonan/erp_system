import streamlit as st
import pandas as pd
import io
from datetime import datetime

def render(conn):
    st.header("📊 数据综合看板")
    
    try:
        # 1. 加载数据
        qa_df = pd.read_sql("SELECT * FROM qa_flow", conn)
        pkg_df = pd.read_sql("SELECT * FROM pkg_flow", conn)
        # 确保加载了 商家编码
        ord_data = pd.read_sql("SELECT 生产单号, 产品批次号, 生产商, 计划生产次数, 状态, 商家编码 FROM orders", conn)
        price_data = pd.read_sql("SELECT 商家编码, 货品名称, 规格名称, 加工点工价, 只包装工价, 剪包工价 FROM prices", conn)

        # 2. 标准化处理函数：去除空格、转大写、去除重复列
        def clean_df(df):
            if df.empty: return df
            # 清洗列名
            df.columns = [c.strip().upper() for c in df.columns]
            # 去除重复列名
            df = df.loc[:, ~df.columns.duplicated()]
            # 清洗关键数据列 (字符串去空格)
            for col in ['商家编码', '生产单号', '产品批次号']:
                if col in df.columns:
                    df[col] = df[col].astype(str).str.strip()
            return df

        qa_df = clean_df(qa_df)
        pkg_df = clean_df(pkg_df)
        ord_data = clean_df(ord_data)
        price_data = clean_df(price_data)
        
        # ---------------------------------------------------------
        # 4. 页面布局与展示
        # ---------------------------------------------------------
        tabs = st.tabs(["✨ 质检绩效 (结算)", "📦 包装绩效 (结算)", "📈 数据分析", "🛠️ SQL 高级查询"])
        
        # --- Tab 1: 质检绩效 ---
        with tabs[0]:
            if not qa_df.empty:
                display_df = qa_df.copy()
                
                # 为了让表格显示货品名称，尝试合并 price_data (可选优化)
                if '货品名称' not in display_df.columns and '商家编码' in display_df.columns:
                     temp_map = price_data[['商家编码', '货品名称']].drop_duplicates()
                     display_df = pd.merge(display_df, temp_map, on='商家编码', how='left')

                # 计算“实际结算金额”
                display_df['结算状态金额'] = display_df.apply(
                    lambda x: x['结算金额'] if str(x.get('产品批次状态', '')).strip() == '已完结' else 0.0, 
                    axis=1
                )
                
                display_cols_qa = ['操作时间', '产品批次号', '产品批次状态', '生产单号', '生产单状态', '生产商', '货品名称', '合格数量', '加工点工价', '结算状态金额']
                actual_qa_cols = [c for c in display_cols_qa if c in display_df.columns]
                
                c_title, c_exp = st.columns([4, 1])
                c_title.subheader("生产质检结算看板")
                
                with c_exp:
                    try:
                        output_qa = io.BytesIO()
                        with pd.ExcelWriter(output_qa, engine='xlsxwriter') as writer:
                            display_df[actual_qa_cols].to_excel(writer, index=False, sheet_name='结算明细')
                        st.download_button(label="📥 导出对账单", data=output_qa.getvalue(), file_name=f"生产结算_{datetime.now().strftime('%m%d')}.xlsx")
                    except: st.warning("导出引擎异常")

                st.dataframe(
                    display_df[actual_qa_cols], 
                    use_container_width=True, hide_index=True,
                    column_config={
                        "产品批次状态": st.column_config.TextColumn("批次总状态"),
                        "生产单状态": st.column_config.TextColumn("生产单状态"),
                        "加工点工价": st.column_config.NumberColumn("工价", format="¥%.2f"),
                        "结算状态金额": st.column_config.NumberColumn("可结算金额", format="¥%.2f"),
                    }
                )
                
                st.divider()
                if '产品批次状态' in display_df.columns:
                    settled_mask = display_df['产品批次状态'] == '已完结'
                    q_total_qty = display_df['合格数量'].sum()
                    q_settled_money = display_df.loc[settled_mask, '结算金额'].sum()
                    q_pending_money = display_df.loc[~settled_mask, '结算金额'].sum()
                    
                    m1, m2, m3 = st.columns(3)
                    m1.metric("累计合格总数", f"{int(q_total_qty)} 件")
                    m2.metric("已结算金额", f"¥ {q_settled_money:,.2f}")
                    m3.metric("待结算(批次锁定)", f"¥ {q_pending_money:,.2f}", delta_color="inverse")
            else:
                st.info("💡 暂无质检绩效录入数据。")

        # --- Tab 2: 包装绩效 ---
        with tabs[1]:
            if not pkg_df.empty:
                display_cols_pkg = ['操作时间', '包装工', '类型', '商家编码', '货品名称', '规格名称', '数量', '执行单价', '结算金额']
                actual_cols = [c for c in display_cols_pkg if c in pkg_df.columns]
                
                c_title_p, c_exp_p = st.columns([4, 1])
                c_title_p.subheader("包装生产绩效结算清单")
                with c_exp_p:
                    try:
                        output_pkg = io.BytesIO()
                        with pd.ExcelWriter(output_pkg, engine='xlsxwriter') as writer:
                            pkg_df[actual_cols].to_excel(writer, index=False, sheet_name='包装明细')
                        st.download_button(label="📥 导出包装单", data=output_pkg.getvalue(), file_name=f"包装绩效_{datetime.now().strftime('%m%d')}.xlsx")
                    except: st.warning("请检查是否安装 xlsxwriter")

                st.dataframe(pkg_df[actual_cols], use_container_width=True, hide_index=True)
                st.divider()
                col_m1, col_m2 = st.columns(2)
                col_m1.metric("累计包装总数", f"{int(pkg_df['数量'].sum())} 件")
                col_m2.metric("累计应付总额", f"¥ {pkg_df['结算金额'].sum():,.2f}")
            else:
                st.info("💡 暂无包装录入数据。")

        # --- [修复版] Tab 3: 数据分析 ---
        with tabs[2]:
            st.subheader("📊 生产批次深度分析")
            
            if not qa_df.empty and not ord_data.empty:
                col_ana_1, col_ana_2 = st.columns(2)

                # --- 1. 同批次合格率分析 ---
                with col_ana_1:
                    st.markdown("##### 🏆 批次合格率统计")
                    
                    agg_cols = ['合格数量']
                    if '不合格数量' in qa_df.columns:
                        agg_cols.append('不合格数量')
                    
                    # 按批次号分组聚合
                    batch_stats = qa_df.groupby('产品批次号')[agg_cols].sum().reset_index()
                    
                    if '不合格数量' in batch_stats.columns:
                        batch_stats['总产量'] = batch_stats['合格数量'] + batch_stats['不合格数量']
                        batch_stats['合格率'] = batch_stats.apply(
                            lambda x: x['合格数量'] / x['总产量'] if x['总产量'] > 0 else 0, axis=1
                        )
                        
                        st.dataframe(
                            batch_stats,
                            column_config={
                                "合格率": st.column_config.ProgressColumn("合格率", format="%.1f%%", min_value=0, max_value=1),
                                "总产量": st.column_config.NumberColumn("质检总数"),
                                "合格数量": st.column_config.NumberColumn("合格"),
                                "不合格数量": st.column_config.NumberColumn("不合格")
                            },
                            use_container_width=True, hide_index=True
                        )
                    else:
                        st.dataframe(batch_stats, use_container_width=True)

                # --- 2. 在途(未完成)生产单分析 ---
                with col_ana_2:
                    st.markdown("##### ⏳ 生产进度滞后分析")
                    st.caption("筛选逻辑：已开工(有质检记录) 但 累计合格数 < 计划生产数")
                    
                    # 1. 统计 QA 表中的实际累计产量
                    # 【修复】这里移除了 '货品名称'，因为 qa_flow 表里没有这列
                    group_keys = ['产品批次号', '生产单号', '商家编码']
                    # 确保这些列都存在
                    valid_keys = [k for k in group_keys if k in qa_df.columns]
                    
                    qa_progress = qa_df.groupby(valid_keys).agg({
                        '合格数量': 'sum'
                    }).reset_index().rename(columns={'合格数量': '累计合格'})
                    
                    # 2. 准备计划数据
                    plan_data = ord_data[['生产单号', '商家编码', '计划生产次数']]
                    
                    # 3. 准备货品名称映射 (从 price_data 获取)
                    sku_map = price_data[['商家编码', '货品名称']].drop_duplicates()
                    
                    # 4. 合并数据：QA进度 + 计划数
                    analysis_df = pd.merge(qa_progress, plan_data, on=['生产单号', '商家编码'], how='left')
                    
                    # 5. 再合并货品名称
                    analysis_df = pd.merge(analysis_df, sku_map, on='商家编码', how='left')
                    
                    # 填充空值
                    analysis_df['计划生产次数'] = analysis_df['计划生产次数'].fillna(0)
                    analysis_df['货品名称'] = analysis_df['货品名称'].fillna('未知货品')
                    
                    # 6. 计算并筛选
                    analysis_df['未完成数量'] = analysis_df['计划生产次数'] - analysis_df['累计合格']
                    unfinished_orders = analysis_df[analysis_df['未完成数量'] > 0].copy()
                    
                    if not unfinished_orders.empty:
                        unfinished_orders['进度'] = unfinished_orders.apply(
                            lambda x: x['累计合格'] / x['计划生产次数'] if x['计划生产次数'] > 0 else 0, axis=1
                        )
                        
                        st.metric("未达标单据数", f"{len(unfinished_orders)} 单")
                        
                        # 定义展示列
                        show_cols = ['产品批次号', '生产单号', '货品名称', '累计合格', '计划生产次数', '进度', '未完成数量']
                        final_show_cols = [c for c in show_cols if c in unfinished_orders.columns]

                        st.dataframe(
                            unfinished_orders[final_show_cols],
                            column_config={
                                "进度": st.column_config.ProgressColumn("完成度", format="%.0f%%", min_value=0, max_value=1),
                                "未完成数量": st.column_config.NumberColumn("缺口")
                            },
                            use_container_width=True, hide_index=True
                        )
                    else:
                        st.success("🎉 所有已开工生产单均已达标！")
            else:
                st.info("暂无数据。")

        # --- Tab 4: SQL 查询 ---
        # ... (前面的代码保持不变) ...

        # --- Tab 4: SQL 高级查询与数据库管理 ---
        with tabs[3]:
            st.warning("⚠️ 注意：在此处执行的操作将直接修改数据库，请谨慎操作！")
            
            # 使用 expander 将读写操作分开，避免误触
            mode = st.radio("选择操作模式", ["🔍 数据查询 (SELECT)", "🛠️ 数据变更 (INSERT/UPDATE/DELETE)"], horizontal=True)

            if mode == "🔍 数据查询 (SELECT)":
                st.caption("用于读取数据，支持导出结果。")
                query = st.text_area("输入查询 SQL", value="SELECT * FROM pkg_flow LIMIT 10", height=150)
                
                if st.button("⚡ 执行查询"):
                    try:
                        res = pd.read_sql(query, conn)
                        st.success(f"查询成功，共找到 {len(res)} 条记录。")
                        st.dataframe(res, use_container_width=True)
                    except Exception as e:
                        st.error(f"查询错误: {e}")

            else:
                st.caption("用于执行增删改操作，执行后无法撤销。")
                write_sql = st.text_area("输入变更 SQL", value="UPDATE orders SET 状态 = '已完成' WHERE 生产单号 = 'TEST001'", height=150, help="请确保语法正确，建议先在查询模式下确认条件。")
                
                # 增加一个确认检查框，防止手抖
                confirm = st.checkbox("我确认 SQL 语句无误，并承担数据变更风险")
                
                if st.button("🔴 执行变更操作", type="primary", disabled=not confirm):
                    if not write_sql.strip():
                        st.warning("SQL 语句不能为空")
                    else:
                        try:
                            # 1. 获取游标
                            cursor = conn.cursor()
                            # 2. 执行 SQL
                            cursor.execute(write_sql)
                            # 3. 提交事务 (对于增删改，必须 commit 才能生效)
                            conn.commit()
                            
                            st.success(f"✅ 执行成功！影响行数: {cursor.rowcount} 行")
                            
                            # 关闭游标 (可选，视数据库连接池策略而定)
                            cursor.close()
                            
                            # 强制刷新页面以更新缓存数据 (可选)
                            if st.button("🔄 刷新页面查看最新数据"):
                                st.rerun()
                                
                        except Exception as e:
                            # 发生错误时回滚，防止部分数据污染
                            conn.rollback()
                            st.error(f"❌ 执行失败: {e}")

    except Exception as e:
        st.error(f"看板加载失败: {e}")
            