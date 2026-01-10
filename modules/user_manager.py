import streamlit as st
import pandas as pd
from database import add_user

def render(conn):
    st.markdown("## 👤 用户注册与管理")
    
    # 左右分栏：左边注册，右边看列表
    col1, col2 = st.columns([1, 2])
    
    # --- 左侧：注册表单 ---
    with col1:
        st.info("📝 新增用户")
        with st.form("register_form"):
            new_user = st.text_input("登录账号 (必填)")
            new_pass = st.text_input("登录密码 (必填)", type="password")
            
            # 角色选择
            role_options = ["管理员", "录入员", "看板人员", "质检员", "包装工"]
            new_role = st.selectbox("选择角色", role_options)
            
            # 权限(菜单)选择
            menu_options = ["数据导入", "质检录入", "包装录入", "看板分析", "用户管理"]
            # 根据角色预设一些默认勾选项
            default_menus = []
            if new_role == "管理员":
                default_menus = menu_options
            elif new_role == "录入员":
                default_menus = ["质检录入", "包装录入"]
            
            new_menus = st.multiselect("分配菜单权限", menu_options, default=default_menus)
            
            submitted = st.form_submit_button("确认注册")
            
            if submitted:
                if not new_user or not new_pass:
                    st.error("账号和密码不能为空")
                elif not new_menus:
                    st.error("请至少分配一个菜单权限")
                else:
                    # 调用数据库函数
                    success, msg = add_user(conn, new_user, new_pass, new_role, new_menus)
                    if success:
                        st.success(f"用户 【{new_user}】 {msg}")
                        st.rerun() # 刷新页面显示新数据
                    else:
                        st.error(msg)

    # --- 右侧：用户列表 ---
    with col2:
        st.warning("📋 已注册用户列表")
        # 查询除密码外的用户信息
        df_users = pd.read_sql("SELECT username, role, menus FROM users", conn)
        st.dataframe(df_users, use_container_width=True)