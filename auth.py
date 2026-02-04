import streamlit as st

USER_CREDS = {
    "admin": {"pw": "123", "role": "管理员", "menus": ["数据导入", "质检录入", "包装录入", "看板分析"]},
    "staff": {"pw": "456", "role": "录入员", "menus": ["质检录入", "包装录入"]},
    "boss":  {"pw": "789", "role": "看板人员", "menus": ["看板分析"]}
}

def init_auth():
    if 'auth' not in st.session_state:
        st.session_state.auth = {'ok': False, 'role': '', 'user': '', 'menus': []}

def login():
    st.sidebar.title("🔐 登录系统")
    u = st.sidebar.text_input("账号")
    p = st.sidebar.text_input("密码", type="password")
    if st.sidebar.button("登录"):
        if u in USER_CREDS and USER_CREDS[u]["pw"] == p:
            st.session_state.auth.update({
                'ok': True, 
                'role': USER_CREDS[u]["role"], 
                'user': u, 
                'menus': USER_CREDS[u]["menus"]
            })
            st.rerun()
        else:
            st.sidebar.error("账号或密码错误")