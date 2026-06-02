from datetime import date

import pandas as pd
import streamlit as st
from supabase import Client, create_client

from billing import (
    DISPLAY_COLUMNS,
    ROOM_DISPLAY_COLUMNS,
    UNIT_PRICE_DISPLAY_COLUMNS,
    UnitPrices,
    build_base_from_previous,
    build_base_from_rooms,
    compute_billing,
    default_data,
    default_rooms,
    default_unit_prices,
    find_meter_warnings,
    get_previous_month_label,
    is_valid_month_label,
    normalize_columns,
    normalize_room_columns,
    summarize_month,
    to_csv_bytes,
    to_excel_bytes,
    unit_prices_to_dict,
)
from storage import (
    MissingTableError,
    StorageError,
    delete_history_sheet,
    history_exists,
    list_history_sheets,
    load_history_sheet,
    load_rooms,
    load_unit_prices,
    save_history_sheet,
    save_rooms,
    save_unit_prices,
)


st.set_page_config(page_title="Nha tro - Tinh tien", layout="wide")

st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap');

    :root {
        --bg: #f7f6f2;
        --ink: #1f2a2e;
        --muted: #66737a;
        --accent: #d96554;
        --accent-soft: rgba(217, 101, 84, 0.12);
        --stroke: #ddd8cf;
    }

    .stApp {
        background: var(--bg);
        color: var(--ink);
        font-family: 'Work Sans', sans-serif;
    }

    .app-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
    }

    .eyebrow {
        display: inline-block;
        padding: 3px 9px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
    }

    .main-title {
        font-size: 32px;
        line-height: 1.2;
        margin: 6px 0 3px 0;
        color: var(--ink);
        font-weight: 700;
        letter-spacing: 0;
    }

    .subtitle {
        color: var(--muted);
        margin: 0;
        font-size: 14px;
    }

    .month-chip {
        min-width: 110px;
        padding: 7px 10px;
        border: 1px solid var(--stroke);
        border-radius: 8px;
        background: #fff;
        color: var(--ink);
        text-align: center;
        font-weight: 700;
    }

    .section-title {
        font-weight: 700;
        color: var(--ink);
        margin: 6px 0 8px 0;
    }

    div.stButton > button {
        background: var(--accent);
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        font-weight: 700;
    }

    div.stButton > button:hover {
        background: #c95545;
    }

    .stDownloadButton button {
        border-radius: 8px;
        border: 1px solid var(--stroke);
    }
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_resource(show_spinner=False)
def get_supabase_client() -> Client:
    config = st.secrets["supabase"]
    return create_client(config["url"], config["service_role_key"])


def get_configured_password() -> str | None:
    try:
        auth_config = st.secrets.get("auth", {})
        return auth_config.get("password")
    except Exception:
        return None


def require_login() -> None:
    password = get_configured_password()
    if not password or st.session_state.get("authenticated"):
        return

    st.markdown("<div class='main-title'>Đăng nhập</div>", unsafe_allow_html=True)
    entered_password = st.text_input("Mật khẩu", type="password")
    if st.button("Vào ứng dụng"):
        if entered_password == password:
            st.session_state["authenticated"] = True
            st.rerun()
        st.error("Mật khẩu không đúng.")
    st.stop()


def remember_error(key: str, error: Exception) -> None:
    st.session_state[key] = str(error)


def get_unit_prices_for_month(client: Client, month_label: str) -> UnitPrices:
    try:
        current_prices = load_unit_prices(client, month_label)
        if current_prices:
            st.session_state.pop("unit_price_error", None)
            return current_prices

        prev_month_label = get_previous_month_label(month_label)
        previous_prices = load_unit_prices(client, prev_month_label) if prev_month_label else None
        st.session_state.pop("unit_price_error", None)
        return previous_prices or default_unit_prices()
    except StorageError as exc:
        remember_error("unit_price_error", exc)
        return default_unit_prices()


def load_history(client: Client, month_label: str) -> tuple[pd.DataFrame, UnitPrices | None]:
    try:
        history_df, snapshot_prices = load_history_sheet(client, month_label)
        st.session_state.pop("billing_history_error", None)
        return history_df, snapshot_prices
    except StorageError as exc:
        remember_error("billing_history_error", exc)
        return pd.DataFrame(), None


def load_room_defaults(client: Client) -> pd.DataFrame:
    try:
        rooms_df = load_rooms(client)
        st.session_state.pop("rooms_error", None)
        st.session_state.pop("rooms_setup_hint", None)
        return normalize_room_columns(rooms_df) if not rooms_df.empty else default_rooms()
    except MissingTableError as exc:
        st.session_state["rooms_setup_hint"] = str(exc)
        st.session_state.pop("rooms_error", None)
        return default_rooms()
    except StorageError as exc:
        remember_error("rooms_error", exc)
        return default_rooms()


def build_initial_table(client: Client, month_label: str, month_is_valid: bool) -> pd.DataFrame:
    prev_month_label = get_previous_month_label(month_label) if month_is_valid else None
    prev_df, _ = load_history(client, prev_month_label) if prev_month_label else (pd.DataFrame(), None)
    if not prev_df.empty:
        st.caption(f"Lấy số cũ từ tháng {prev_month_label}.")
        return build_base_from_previous(prev_df)

    rooms_df = load_room_defaults(client)
    if not rooms_df.empty:
        st.caption("Không có tháng trước, tạo bảng từ danh sách phòng.")
        return build_base_from_rooms(rooms_df)

    return default_data()


def render_header(month_label: str) -> None:
    st.markdown(
        f"""
        <div class="app-header">
            <div>
                <span class="eyebrow">Phiếu tính tiền</span>
                <div class="main-title">Quản lý tiền nhà trọ</div>
                <p class="subtitle">Nhập chỉ số, tính phí, lưu lịch sử và quản lý phòng theo tháng.</p>
            </div>
            <div class="month-chip">{month_label or "YYYY-MM"}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_sidebar(client: Client) -> tuple[str, bool, UnitPrices]:
    with st.sidebar:
        st.markdown("<div class='section-title'>Tháng và đơn giá</div>", unsafe_allow_html=True)
        month_label = st.text_input("Tháng", value=date.today().strftime("%Y-%m")).strip()
        month_is_valid = is_valid_month_label(month_label)
        if not month_is_valid:
            st.warning("Dùng định dạng YYYY-MM, ví dụ 2026-06.")

        saved_prices = get_unit_prices_for_month(client, month_label) if month_is_valid else default_unit_prices()
        prices = UnitPrices(
            electric_price=st.number_input("Điện (VND/kWh)", min_value=0.0, value=saved_prices.electric_price, step=100.0, key=f"electric_price_{month_label}"),
            water_price_m3=st.number_input("Nước/m3", min_value=0.0, value=saved_prices.water_price_m3, step=500.0, key=f"water_price_m3_{month_label}"),
            water_price_person=st.number_input("Nước/người", min_value=0.0, value=saved_prices.water_price_person, step=1000.0, key=f"water_price_person_{month_label}"),
            water_fixed=st.number_input("Nước cố định/phòng", min_value=0.0, value=saved_prices.water_fixed, step=1000.0, key=f"water_fixed_{month_label}"),
            trash_fee=st.number_input("Rác/phòng", min_value=0.0, value=saved_prices.trash_fee, step=1000.0, key=f"trash_fee_{month_label}"),
            light_fee=st.number_input("Đèn VS/phòng", min_value=0.0, value=saved_prices.light_fee, step=1000.0, key=f"light_fee_{month_label}"),
        )

        if st.button("Lưu đơn giá", width='stretch'):
            if month_is_valid:
                try:
                    save_unit_prices(client, month_label, prices)
                    st.success(f"Đã lưu đơn giá {month_label}.")
                except StorageError as exc:
                    st.error(exc)
            else:
                st.error("Vui lòng nhập tháng hợp lệ.")

        if st.session_state.get("unit_price_error"):
            st.warning(st.session_state["unit_price_error"])

    return month_label, month_is_valid, prices


def render_billing_tab(client: Client, month_label: str, month_is_valid: bool, prices: UnitPrices) -> None:
    control_cols = st.columns([1.25, 1, 1])
    with control_cols[0]:
        input_source = st.segmented_control(
            "Nguồn dữ liệu",
            ["Tự động", "Tháng trước", "Danh sách phòng", "Tải file"],
            default="Tự động",
        )
    with control_cols[1]:
        uploaded = st.file_uploader("Excel/CSV", type=["csv", "xlsx"], label_visibility="collapsed") if input_source == "Tải file" else None
    with control_cols[2]:
        st.write("")
        run_calc = st.button("Tính tiền", width='stretch')

    if uploaded:
        try:
            raw_df = pd.read_csv(uploaded) if uploaded.name.lower().endswith(".csv") else pd.read_excel(uploaded)
            base_df = normalize_columns(raw_df)
        except Exception as exc:
            st.error(f"Không đọc được file tải lên: {exc}")
            base_df = default_data()
    elif input_source == "Tháng trước":
        prev_month_label = get_previous_month_label(month_label) if month_is_valid else None
        prev_df, _ = load_history(client, prev_month_label) if prev_month_label else (pd.DataFrame(), None)
        base_df = build_base_from_previous(prev_df) if not prev_df.empty else default_data()
    elif input_source == "Danh sách phòng":
        base_df = build_base_from_rooms(load_room_defaults(client))
    else:
        base_df = build_initial_table(client, month_label, month_is_valid)

    st.markdown("<div class='section-title'>Bảng nhập liệu</div>", unsafe_allow_html=True)
    edited_df = st.data_editor(
        base_df.rename(columns=DISPLAY_COLUMNS),
        num_rows="dynamic",
        width='stretch',
        disabled=["Số điện cũ", "Số nước cũ"],
        column_config={
            "Cách tính nước": st.column_config.SelectboxColumn("Cách tính nước", options=["m3", "people", "fixed"]),
            "Giá phòng": st.column_config.NumberColumn("Giá phòng", format="%d VND"),
            "Phụ phí (+/-)": st.column_config.NumberColumn("Phụ phí (+/-)", format="%d VND"),
            "Rác (ghi đè)": st.column_config.NumberColumn("Rác (ghi đè)", format="%d VND"),
            "Đèn VS (ghi đè)": st.column_config.NumberColumn("Đèn VS (ghi đè)", format="%d VND"),
            "Nước cố định (ghi đè)": st.column_config.NumberColumn("Nước cố định (ghi đè)", format="%d VND"),
        },
    ).rename(columns={value: key for key, value in DISPLAY_COLUMNS.items()})

    for warning in find_meter_warnings(edited_df):
        st.warning(warning)

    if run_calc:
        st.session_state["last_result"] = compute_billing(edited_df, prices)
        st.session_state["last_result_month"] = month_label

    if "last_result" not in st.session_state:
        st.info("Nhập dữ liệu và bấm Tính tiền để xem kết quả.")
        return

    result_df = st.session_state["last_result"]
    result_month = st.session_state.get("last_result_month")
    if result_month and result_month != month_label:
        st.warning(f"Kết quả đang là tháng {result_month}. Bấm Tính tiền lại trước khi lưu tháng {month_label}.")

    st.markdown("<div class='section-title'>Kết quả</div>", unsafe_allow_html=True)
    summary = summarize_month(result_df)
    metric_cols = st.columns(4)
    metric_cols[0].metric("Số phòng", f"{summary['rooms']}")
    metric_cols[1].metric("Tổng thu", f"{summary['total']:,.0f} VND")
    metric_cols[2].metric("Điện tiêu thụ", f"{summary['electric_usage']:,.0f}")
    metric_cols[3].metric("Chi phí nước", f"{summary['water_cost']:,.0f} VND")

    st.dataframe(result_df.rename(columns=DISPLAY_COLUMNS), width='stretch')
    action_cols = st.columns([1, 1, 1, 2])
    with action_cols[0]:
        st.download_button(
            "Tải Excel",
            data=to_excel_bytes(result_df.rename(columns=DISPLAY_COLUMNS)),
            file_name=f"tinh_tien_nha_tro_{month_label}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            width='stretch',
        )
    with action_cols[1]:
        st.download_button(
            "Tải CSV",
            data=to_csv_bytes(result_df.rename(columns=DISPLAY_COLUMNS)),
            file_name=f"tinh_tien_nha_tro_{month_label}.csv",
            mime="text/csv",
            width='stretch',
        )
    with action_cols[2]:
        exists = False
        if month_is_valid:
            try:
                exists = history_exists(client, month_label)
            except StorageError as exc:
                st.warning(exc)
        overwrite = st.checkbox("Ghi đè", value=not exists, disabled=not exists)
    with action_cols[3]:
        if st.button("Lưu vào lịch sử", width='stretch'):
            if not month_is_valid:
                st.error("Vui lòng nhập tháng hợp lệ.")
            elif exists and not overwrite:
                st.error("Tháng này đã tồn tại. Chọn Ghi đè nếu muốn lưu lại.")
            else:
                try:
                    save_history_sheet(client, month_label, result_df, prices)
                    save_unit_prices(client, month_label, prices)
                    st.success(f"Đã lưu lịch sử và đơn giá {month_label}.")
                except StorageError as exc:
                    st.error(exc)


def render_history_tab(client: Client) -> None:
    try:
        history_sheets = list_history_sheets(client)
        st.session_state.pop("billing_history_error", None)
    except StorageError as exc:
        history_sheets = []
        remember_error("billing_history_error", exc)

    if st.session_state.get("billing_history_error"):
        st.warning(st.session_state["billing_history_error"])

    if not history_sheets:
        st.info("Chưa có dữ liệu lịch sử.")
        return

    selected_sheet = st.selectbox("Chọn tháng", options=sorted(history_sheets, reverse=True))
    history_df, snapshot_prices = load_history(client, selected_sheet)
    if not history_df.empty:
        history_summary = summarize_month(history_df)
        metric_cols = st.columns(4)
        metric_cols[0].metric("Số phòng", f"{history_summary['rooms']}")
        metric_cols[1].metric("Tổng thu", f"{history_summary['total']:,.0f} VND")
        metric_cols[2].metric("Điện tiêu thụ", f"{history_summary['electric_usage']:,.0f}")
        metric_cols[3].metric("Chi phí nước", f"{history_summary['water_cost']:,.0f} VND")

    if snapshot_prices:
        with st.expander("Đơn giá trong hóa đơn"):
            st.dataframe(
                pd.DataFrame([unit_prices_to_dict(snapshot_prices)]).rename(columns=UNIT_PRICE_DISPLAY_COLUMNS),
                width='stretch',
            )

    st.dataframe(history_df.rename(columns=DISPLAY_COLUMNS), width='stretch')
    manage_cols = st.columns([1, 1, 2])
    with manage_cols[0]:
        st.download_button(
            "Tải Excel",
            data=to_excel_bytes(history_df.rename(columns=DISPLAY_COLUMNS)),
            file_name=f"lich_su_{selected_sheet}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            width='stretch',
        )
    with manage_cols[1]:
        confirm_delete = st.checkbox("Xác nhận xóa")
    with manage_cols[2]:
        if st.button("Xóa tháng đã chọn", disabled=not confirm_delete, width='stretch'):
            try:
                delete_history_sheet(client, selected_sheet)
                st.success(f"Đã xóa tháng {selected_sheet}.")
                st.rerun()
            except StorageError as exc:
                st.error(exc)


def render_rooms_tab(client: Client) -> None:
    rooms_df = load_room_defaults(client)
    if st.session_state.get("rooms_setup_hint"):
        st.info(st.session_state["rooms_setup_hint"])
    if st.session_state.get("rooms_error"):
        st.warning(st.session_state["rooms_error"])

    st.markdown("<div class='section-title'>Danh sách phòng mặc định</div>", unsafe_allow_html=True)
    edited_rooms = st.data_editor(
        rooms_df.rename(columns=ROOM_DISPLAY_COLUMNS),
        num_rows="dynamic",
        width='stretch',
        column_config={
            "Cách tính nước": st.column_config.SelectboxColumn("Cách tính nước", options=["m3", "people", "fixed"]),
            "Giá phòng": st.column_config.NumberColumn("Giá phòng", format="%d VND"),
            "Rác (ghi đè)": st.column_config.NumberColumn("Rác (ghi đè)", format="%d VND"),
            "Đèn VS (ghi đè)": st.column_config.NumberColumn("Đèn VS (ghi đè)", format="%d VND"),
            "Nước cố định (ghi đè)": st.column_config.NumberColumn("Nước cố định (ghi đè)", format="%d VND"),
            "Đang thuê": st.column_config.CheckboxColumn("Đang thuê"),
        },
    ).rename(columns={value: key for key, value in ROOM_DISPLAY_COLUMNS.items()})

    if st.button("Lưu danh sách phòng", width='content'):
        try:
            save_rooms(client, normalize_room_columns(edited_rooms))
            st.session_state.pop("rooms_setup_hint", None)
            st.success("Đã lưu danh sách phòng.")
        except MissingTableError as exc:
            st.info(exc)
        except StorageError as exc:
            st.error(exc)


require_login()
client = get_supabase_client()
month_label, month_is_valid, prices = render_sidebar(client)
render_header(month_label)

main_tab, history_tab, rooms_tab = st.tabs(["Tính tiền", "Lịch sử", "Phòng"])
with main_tab:
    render_billing_tab(client, month_label, month_is_valid, prices)
with history_tab:
    render_history_tab(client)
with rooms_tab:
    render_rooms_tab(client)
