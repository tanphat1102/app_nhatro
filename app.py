import io
from datetime import date
from pathlib import Path
from dataclasses import dataclass

import pandas as pd
import streamlit as st


st.set_page_config(page_title="Nha tro - Tinh tien", layout="wide")

st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Work+Sans:wght@400;500;600&display=swap');

    :root {
        --bg-1: #f8efe6;
        --bg-2: #f1f7f4;
        --ink: #1f2a2e;
        --muted: #5b6b73;
        --accent: #e26d5c;
        --accent-2: #2a9d8f;
        --card: #ffffff;
        --stroke: #e7e1d8;
    }

    .stApp {
        background: radial-gradient(1200px 600px at 5% 0%, var(--bg-1), transparent),
                    radial-gradient(1000px 500px at 90% 10%, var(--bg-2), transparent),
                    #fbfaf7;
        color: var(--ink);
        font-family: 'Work Sans', sans-serif;
    }

    .main-title {
        font-family: 'Playfair Display', serif;
        font-size: 40px;
        margin: 0 0 6px 0;
        color: var(--ink);
        letter-spacing: 0.2px;
    }

    .subtitle {
        color: var(--muted);
        margin-bottom: 18px;
    }

    .card {
        background: var(--card);
        border: 1px solid var(--stroke);
        border-radius: 14px;
        padding: 16px 18px;
        box-shadow: 0 8px 24px rgba(23, 26, 28, 0.06);
    }

    .pill {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(226, 109, 92, 0.12);
        color: var(--accent);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.4px;
        text-transform: uppercase;
    }

    .section-title {
        font-weight: 600;
        color: var(--ink);
        margin-bottom: 8px;
    }

    div.stButton > button {
        background: var(--accent);
        color: #ffffff;
        border: none;
        border-radius: 10px;
        padding: 8px 18px;
        font-weight: 600;
    }

    div.stButton > button:hover {
        background: #d45f4f;
    }

    .stDownloadButton button {
        border-radius: 10px;
        border: 1px solid var(--stroke);
    }
    </style>
    """,
    unsafe_allow_html=True,
)


@dataclass
class UnitPrices:
    electric_price: float
    water_price_m3: float
    water_price_person: float
    water_fixed: float
    trash_fee: float
    light_fee: float


def default_data() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Room": "P1",
                "PrevElectric": 1200,
                "NewElectric": 1325,
                "PrevWater": 85,
                "NewWater": 92,
                "WaterCalcType": "m3",
                "PeopleCount": 0,
                "RoomPrice": 2500000,
                "ExtraCharge": 0,
                "ExtraNote": "",
                "TrashOverride": None,
                "LightOverride": None,
                "WaterFixedOverride": None,
            },
            {
                "Room": "P2",
                "PrevElectric": 980,
                "NewElectric": 1100,
                "PrevWater": 0,
                "NewWater": 0,
                "WaterCalcType": "people",
                "PeopleCount": 2,
                "RoomPrice": 2800000,
                "ExtraCharge": -50000,
                "ExtraNote": "Sửa cửa",
                "TrashOverride": None,
                "LightOverride": None,
                "WaterFixedOverride": None,
            },
        ]
    )


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    expected = [
        "Room",
        "PrevElectric",
        "NewElectric",
        "PrevWater",
        "NewWater",
        "WaterCalcType",
        "PeopleCount",
        "RoomPrice",
        "ExtraCharge",
        "ExtraNote",
        "TrashOverride",
        "LightOverride",
        "WaterFixedOverride",
    ]
    missing = [col for col in expected if col not in df.columns]
    for col in missing:
        df[col] = None
    df = df[expected]
    return df


DISPLAY_COLUMNS = {
    "Room": "Phòng",
    "PrevElectric": "Số điện cũ",
    "NewElectric": "Số điện mới",
    "PrevWater": "Số nước cũ",
    "NewWater": "Số nước mới",
    "WaterCalcType": "Cách tính nước",
    "PeopleCount": "Số người",
    "RoomPrice": "Giá phòng",
    "ExtraCharge": "Phụ phí (+/-)",
    "ExtraNote": "Ghi chú phụ phí",
    "TrashOverride": "Rác (ghi đè)",
    "LightOverride": "Đèn VS (ghi đè)",
    "WaterFixedOverride": "Nước cố định (ghi đè)",
}

REVERSE_COLUMNS = {value: key for key, value in DISPLAY_COLUMNS.items()}


def coerce_numeric(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    for col in cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return df


def compute_billing(df: pd.DataFrame, prices: UnitPrices) -> pd.DataFrame:
    df = df.copy()

    df = coerce_numeric(
        df,
        [
            "PrevElectric",
            "NewElectric",
            "PrevWater",
            "NewWater",
            "PeopleCount",
            "RoomPrice",
            "ExtraCharge",
            "TrashOverride",
            "LightOverride",
            "WaterFixedOverride",
        ],
    )

    df["ElectricUsage"] = (df["NewElectric"] - df["PrevElectric"]).clip(lower=0)
    df["ElectricCost"] = df["ElectricUsage"] * prices.electric_price

    water_type = df["WaterCalcType"].fillna("m3").str.lower()

    water_m3_cost = (df["NewWater"] - df["PrevWater"]).clip(lower=0) * prices.water_price_m3
    water_people_cost = df["PeopleCount"] * prices.water_price_person

    water_fixed_override = df["WaterFixedOverride"]
    water_fixed_cost = water_fixed_override.where(water_fixed_override > 0, prices.water_fixed)

    df["WaterCost"] = 0.0
    df.loc[water_type == "m3", "WaterCost"] = water_m3_cost
    df.loc[water_type == "people", "WaterCost"] = water_people_cost
    df.loc[water_type == "fixed", "WaterCost"] = water_fixed_cost

    trash_fee = df["TrashOverride"].where(df["TrashOverride"] > 0, prices.trash_fee)
    light_fee = df["LightOverride"].where(df["LightOverride"] > 0, prices.light_fee)

    df["TrashFee"] = trash_fee
    df["LightFee"] = light_fee

    df["Total"] = (
        df["RoomPrice"]
        + df["ElectricCost"]
        + df["WaterCost"]
        + df["TrashFee"]
        + df["LightFee"]
        + df["ExtraCharge"]
    )

    return df


def to_excel_bytes(df: pd.DataFrame) -> bytes:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Billing")
    return buffer.getvalue()


def to_csv_bytes(df: pd.DataFrame) -> bytes:
    return df.to_csv(index=False).encode("utf-8")


HISTORY_FILE = Path("data/lich_su_tinh_tien.xlsx")


def ensure_history_dir() -> None:
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)


def list_history_sheets() -> list[str]:
    if not HISTORY_FILE.exists():
        return []
    return pd.ExcelFile(HISTORY_FILE).sheet_names


def load_history_sheet(sheet_name: str) -> pd.DataFrame:
    return pd.read_excel(HISTORY_FILE, sheet_name=sheet_name)


def save_history_sheet(sheet_name: str, df: pd.DataFrame) -> None:
    ensure_history_dir()
    if HISTORY_FILE.exists():
        with pd.ExcelWriter(
            HISTORY_FILE,
            engine="openpyxl",
            mode="a",
            if_sheet_exists="replace",
        ) as writer:
            df.to_excel(writer, index=False, sheet_name=sheet_name)
    else:
        with pd.ExcelWriter(HISTORY_FILE, engine="openpyxl", mode="w") as writer:
            df.to_excel(writer, index=False, sheet_name=sheet_name)


st.markdown("<div class='pill'>PHIẾU TÍNH TIỀN</div>", unsafe_allow_html=True)
st.markdown("<div class='main-title'>Quản lý tính tiền nhà trọ</div>", unsafe_allow_html=True)
st.markdown(
    "<div class='subtitle'>Nhập/Xuất Excel-CSV, thêm chi phí riêng từng phòng, và tính toán tự động.</div>",
    unsafe_allow_html=True,
)

with st.sidebar:
    st.markdown("<div class='section-title'>Đơn giá chung</div>", unsafe_allow_html=True)
    prices = UnitPrices(
        electric_price=st.number_input("Giá điện (VND/kWh)", min_value=0.0, value=3500.0, step=100.0),
        water_price_m3=st.number_input("Giá nước (VND/m3)", min_value=0.0, value=15000.0, step=500.0),
        water_price_person=st.number_input(
            "Giá nước theo người (VND/người)", min_value=0.0, value=70000.0, step=1000.0
        ),
        water_fixed=st.number_input("Giá nước cố định (VND/phòng)", min_value=0.0, value=0.0, step=1000.0),
        trash_fee=st.number_input("Rác (VND/phòng)", min_value=0.0, value=20000.0, step=1000.0),
        light_fee=st.number_input("Đèn VS (VND/phòng)", min_value=0.0, value=10000.0, step=1000.0),
    )
    st.caption("Mẹo: có thể nhập giá riêng cho từng phòng ngay trong bảng.")

left_col, right_col = st.columns([2.4, 1.1], gap="large")

with left_col:
    st.markdown("<div class='section-title'>Nhập dữ liệu</div>", unsafe_allow_html=True)

    uploaded = st.file_uploader("Nhập file Excel/CSV", type=["csv", "xlsx"])
    if uploaded:
        if uploaded.name.lower().endswith(".csv"):
            raw_df = pd.read_csv(uploaded)
        else:
            raw_df = pd.read_excel(uploaded)
        base_df = normalize_columns(raw_df)
    else:
        base_df = default_data()

    display_df = base_df.rename(columns=DISPLAY_COLUMNS)
    edited_df = st.data_editor(
        display_df,
        num_rows="dynamic",
        use_container_width=True,
        column_config={
            "Cách tính nước": st.column_config.SelectboxColumn(
                "Cách tính nước",
                options=["m3", "people", "fixed"],
                help="Chọn cách tính nước: m3, people, fixed",
            )
        },
    )

    edited_df = edited_df.rename(columns=REVERSE_COLUMNS)

    action_col, export_col = st.columns([1, 2])
    with action_col:
        run_calc = st.button("Tính tiền")

with right_col:
    st.markdown("<div class='card'>", unsafe_allow_html=True)
    st.markdown("<div class='section-title'>Hướng dẫn nhanh</div>", unsafe_allow_html=True)
    st.write("1. Tải Excel/CSV (nếu có).")
    st.write("2. Sửa số mới, giá phòng, chi phí phụ.")
    st.write("3. Bấm Tính tiền và tải file kết quả.")
    st.markdown("</div>", unsafe_allow_html=True)

if "run_calc" in locals() and run_calc:
    st.session_state["last_result"] = compute_billing(edited_df, prices)

if "last_result" in st.session_state:
    result_df = st.session_state["last_result"]

    st.markdown("<div class='section-title'>Kết quả</div>", unsafe_allow_html=True)
    metric_cols = st.columns(4)
    total_rooms = int(result_df["Room"].nunique())
    total_revenue = float(result_df["Total"].sum())
    total_electric = float(result_df["ElectricUsage"].sum())
    total_water = float(result_df["WaterCost"].sum())

    metric_cols[0].metric("Số phòng", f"{total_rooms}")
    metric_cols[1].metric("Tổng thu", f"{total_revenue:,.0f} VND")
    metric_cols[2].metric("Điện tiêu thụ", f"{total_electric:,.0f}")
    metric_cols[3].metric("Chi phí nước", f"{total_water:,.0f} VND")

    st.dataframe(result_df.rename(columns=DISPLAY_COLUMNS), use_container_width=True)

    download_cols = st.columns(2)
    with download_cols[0]:
        st.download_button(
            "Tải Excel",
            data=to_excel_bytes(result_df),
            file_name="tinh_tien_nha_tro.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    with download_cols[1]:
        st.download_button(
            "Tải CSV",
            data=to_csv_bytes(result_df),
            file_name="tinh_tien_nha_tro.csv",
            mime="text/csv",
        )

    st.markdown("<div class='section-title'>Lưu tháng</div>", unsafe_allow_html=True)
    default_month = date.today().strftime("%Y-%m")
    month_label = st.text_input("Tháng lưu (YYYY-MM)", value=default_month)
    if st.button("Lưu vào lịch sử"):
        if month_label.strip():
            save_history_sheet(month_label.strip(), result_df)
            if HISTORY_FILE.exists():
                st.success(f"Đã lưu vào: {HISTORY_FILE}")
            else:
                st.error("Lưu không thành công. Vui lòng thử lại.")
        else:
            st.error("Vui lòng nhập tháng hợp lệ (YYYY-MM).")
else:
    st.info("Nhập dữ liệu và bấm 'Tính tiền' để xem kết quả.")

st.markdown("<div class='section-title'>Xem lịch sử</div>", unsafe_allow_html=True)
st.caption(f"Đường dẫn lưu: {HISTORY_FILE}")
history_sheets = list_history_sheets()
if history_sheets:
    selected_sheet = st.selectbox("Chọn tháng", options=sorted(history_sheets, reverse=True))
    history_df = load_history_sheet(selected_sheet)
    st.dataframe(history_df.rename(columns=DISPLAY_COLUMNS), use_container_width=True)
    st.download_button(
        "Tải Excel tháng này",
        data=to_excel_bytes(history_df),
        file_name=f"lich_su_{selected_sheet}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
else:
    st.info("Chưa có dữ liệu lịch sử. Hãy tính tiền và lưu tháng đầu tiên.")
