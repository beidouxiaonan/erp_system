import streamlit as st
import pandas as pd
import io
from datetime import datetime

def render(conn):
    st.header("📊 数据综合看板")
    
    try:
        # 1. 加载并标准化基础数据
        qa_df = pd.read_sql("SELECT * FROM qa_flow", conn)
        pkg_df = pd.read_sql("SELECT * FROM pkg_flow", conn)
        ord_data = pd.read_sql("SELECT 生产单号, 产品批次号, 生产商, 计划生产次数, 状态 FROM orders", conn)
        price_data = pd.read_sql("SELECT 商家编码, 货品名称, 规格名称, 加工点工价, 只包装工价 FROM prices", conn)

        # 【核心修正】强制所有 DataFrame 的列名为大写，解决 "not in index" 报错
        for df in [qa_df, pkg_df, ord_data, price_data]:
            df.columns = [c.upper() for c in df.columns]

        # ---------------------------------------------------------
        # 2. 质检绩效逻辑处理 (关联批次、工价与结算金额)
        # ---------------------------------------------------------
        perf_df = pd.DataFrame()
        if not qa_df.empty:
            perf_df = pd.merge(qa_df, ord_data, on="生产单号", how="left", suffixes=('', '_ORD'))
            perf_df = pd.merge(perf_df, price_data, on="商家编码", how="left", suffixes=('', '_PRI'))
            perf_df['结算金额'] = perf_df['合格数量'] * perf_df['加工点工价'].fillna(0)
            
            # 计算批次整体状态：该批次下所有单号均完结才算完结
            batch_status_map = ord_data.groupby('产品批次号')['状态'].apply(
                lambda x: "已完结" if (x == '已完结').all() else "进行中"
            )
            perf_df['产品批次状态'] = perf_df['产品批次号'].map(batch_status_map)

            # 计算未完成缺口数量
            total_ok_sum = qa_df.groupby('生产单号')['合格数量'].transform('sum')
            perf_df['未完成数量'] = perf_df['计划生产次数'] - total_ok_sum
            perf_df['未完成数量'] = perf_df['未完成数量'].apply(lambda x: max(0, int(x)))

        # ---------------------------------------------------------
        # 3. 包装绩效逻辑处理 (新增结算功能)
        # ---------------------------------------------------------
        full_pkg_df = pd.DataFrame()
        if not pkg_df.empty:
            # 关联价格表获取只包装工价
            full_pkg_df = pd.merge(pkg_df, price_data, on="商家编码", how="left")
            full_pkg_df['结算金额'] = full_pkg_df['数量'] * full_pkg_df['只包装工价'].fillna(0)

        # ---------------------------------------------------------
        # 4. 页面布局与展示
        # ---------------------------------------------------------
        tab_perf, tab_qa, tab_pkg = st.tabs(["✨ 质检绩效 (结算)", "📝 质检对账流水", "📦 包装绩效 (结算)"])
        
        # --- Tab 1: 质检绩效 (带导出功能) ---
        with tab_perf:
            if not perf_df.empty:
                display_cols_qa = [
                    '操作时间', '产品批次号', '产品批次状态', '生产单号', '生产商', 
                    '货品名称', '规格名称', '合格数量', '不合格数量', 
                    '计划生产次数', '未完成数量', '加工点工价', '结算金额'
                ]
                # 过滤掉不存在的列，防止再次报错
                display_cols_qa = [c for c in display_cols_qa if c in perf_df.columns]
                
                c_title, c_exp = st.columns([4, 1])
                c_title.subheader("质检合格产品结算清单")
                with c_exp:
                    try:
                        output_qa = io.BytesIO()
                        with pd.ExcelWriter(output_qa, engine='xlsxwriter') as writer:
                            perf_df[display_cols_qa].to_excel(writer, index=False, sheet_name='质检绩效结算')
                        st.download_button(label="📥 导出质检对账单", data=output_qa.getvalue(), 
                                         file_name=f"质检结算_{datetime.now().strftime('%m%d%H%M')}.xlsx",
                                         mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", use_container_width=True)
                    except: st.warning("请确认安装了 xlsxwriter")

                st.dataframe(perf_df[display_cols_qa], use_container_width=True, hide_index=True,
                            column_config={
                                "结算金额": st.column_config.NumberColumn("结算金额", format="¥%.2f"),
                                "加工点工价": st.column_config.NumberColumn("工价", format="%.2f"),
                                "未完成数量": st.column_config.NumberColumn("未完成数", format="%d ⏳")
                            })
            else:
                st.info("暂无质检绩效数据")

        # --- Tab 2: 原始对账流水 ---
        with tab_qa:
            if not qa_df.empty:
                st.dataframe(qa_df.sort_values("操作时间", ascending=False), use_container_width=True, hide_index=True)
            else:
                st.info("暂无流水记录")

        # --- Tab 3: 包装绩效 (修复列名大小写报错) ---
        with tab_pkg:
            if not full_pkg_df.empty:
                # 【关键修正】使用大写列名匹配标准化后的 DataFrame
                display_cols_pkg = ['操作时间', '包装工', '商家编码', '货品名称', '规格名称', '数量', '只包装工价', '结算金额']
                # 动态检查列名是否存在
                display_cols_pkg = [c for c in display_cols_pkg if c in full_pkg_df.columns]
                
                c_title_p, c_exp_p = st.columns([4, 1])
                c_title_p.subheader("包装生产绩效结算清单")
                with c_exp_p:
                    try:
                        output_pkg = io.BytesIO()
                        with pd.ExcelWriter(output_pkg, engine='xlsxwriter') as writer:
                            full_pkg_df[display_cols_pkg].to_excel(writer, index=False, sheet_name='包装绩效结算')
                        st.download_button(label="📥 导出包装对账单", data=output_pkg.getvalue(), 
                                         file_name=f"包装结算_{datetime.now().strftime('%m%d%H%M')}.xlsx",
                                         mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", use_container_width=True)
                    except: st.warning("请确认安装了 xlsxwriter")

                st.dataframe(full_pkg_df[display_cols_pkg].sort_values("操作时间", ascending=False), 
                            use_container_width=True, hide_index=True,
                            column_config={
                                "结算金额": st.column_config.NumberColumn("结算金额", format="¥%.2f"),
                                "只包装工价": st.column_config.NumberColumn("只包装工价", format="%.2f")
                            })
                
                st.divider()
                p1, p2 = st.columns(2)
                p1.metric("累计包装总数", f"{int(full_pkg_df['数量'].sum())} 件")
                p2.metric("应付包装总额", f"¥ {full_pkg_df['结算金额'].sum():,.2f}")
            else:
                st.info("暂称包装绩效数据")
                
    except Exception as e:
        # 显示具体报错信息以便调试
        st.error(f"看板加载失败: {e}")