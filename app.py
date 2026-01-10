import streamlit as st
from database import init_db
from auth import init_auth, login
from modules import data_import, qa_entry, pkg_entry, dashboard

# 界面配置
st.set_page_config(page_title="工厂MES管理系统", layout="wide")

# 初始化数据库与权限
conn = init_db()
init_auth()

if not st.session_state.auth['ok']:
    st.title("🏭 生产管理系统")
    login()
else:
    st.sidebar.success(f"用户: {st.session_state.auth['user']} ({st.session_state.auth['role']})")
    if st.sidebar.button("退出系统"):
        st.session_state.auth.update({'ok': False})
        st.rerun()
    
    choice = st.sidebar.radio("菜单导航", st.session_state.auth['menus'])

    # 路由转发
    if choice == "数据导入":
        data_import.render(conn)
    elif choice == "质检录入":
        qa_entry.render(conn)
    elif choice == "包装录入":
        pkg_entry.render(conn)
    elif choice == "看板分析":
        dashboard.render(conn)