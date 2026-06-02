import io
from dataclasses import dataclass
from datetime import date

import pandas as pd


@dataclass
class UnitPrices:
    electric_price: float
    water_price_m3: float
    water_price_person: float
    water_fixed: float
    trash_fee: float
    light_fee: float


EXPECTED_COLUMNS = [
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

ROOM_COLUMNS = [
    "Room",
    "WaterCalcType",
    "PeopleCount",
    "RoomPrice",
    "TrashOverride",
    "LightOverride",
    "WaterFixedOverride",
    "Active",
]

NUMERIC_COLUMNS = [
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
]

ROOM_NUMERIC_COLUMNS = [
    "PeopleCount",
    "RoomPrice",
    "TrashOverride",
    "LightOverride",
    "WaterFixedOverride",
]

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

ROOM_DISPLAY_COLUMNS = {
    "Room": "Phòng",
    "WaterCalcType": "Cách tính nước",
    "PeopleCount": "Số người",
    "RoomPrice": "Giá phòng",
    "TrashOverride": "Rác (ghi đè)",
    "LightOverride": "Đèn VS (ghi đè)",
    "WaterFixedOverride": "Nước cố định (ghi đè)",
    "Active": "Đang thuê",
}

REVERSE_COLUMNS = {value: key for key, value in DISPLAY_COLUMNS.items()}
ROOM_REVERSE_COLUMNS = {value: key for key, value in ROOM_DISPLAY_COLUMNS.items()}

UNIT_PRICE_DISPLAY_COLUMNS = {
    "electric_price": "Giá điện",
    "water_price_m3": "Giá nước/m3",
    "water_price_person": "Giá nước/người",
    "water_fixed": "Nước cố định",
    "trash_fee": "Rác",
    "light_fee": "Đèn VS",
}


def default_unit_prices() -> UnitPrices:
    return UnitPrices(
        electric_price=3500.0,
        water_price_m3=15000.0,
        water_price_person=70000.0,
        water_fixed=0.0,
        trash_fee=20000.0,
        light_fee=10000.0,
    )


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


def default_rooms() -> pd.DataFrame:
    rooms = default_data()[["Room", "WaterCalcType", "PeopleCount", "RoomPrice", "TrashOverride", "LightOverride", "WaterFixedOverride"]]
    rooms = rooms.copy()
    rooms["Active"] = True
    return rooms


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.rename(columns=REVERSE_COLUMNS).copy()
    missing = [col for col in EXPECTED_COLUMNS if col not in df.columns]
    for col in missing:
        df[col] = None
    return df[EXPECTED_COLUMNS]


def normalize_room_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.rename(columns=ROOM_REVERSE_COLUMNS).copy()
    missing = [col for col in ROOM_COLUMNS if col not in df.columns]
    for col in missing:
        df[col] = True if col == "Active" else None
    return df[ROOM_COLUMNS]


def coerce_numeric(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    for col in cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return df


def find_meter_warnings(df: pd.DataFrame) -> list[str]:
    check_df = normalize_columns(df).copy()
    check_df["Room"] = check_df["Room"].fillna("").astype(str).str.strip()
    check_df = coerce_numeric(check_df, ["PrevElectric", "NewElectric", "PrevWater", "NewWater"])
    check_df = check_df[check_df["Room"] != ""]

    warnings = []
    electric_rooms = check_df.loc[check_df["NewElectric"] < check_df["PrevElectric"], "Room"].tolist()
    water_rooms = check_df.loc[check_df["NewWater"] < check_df["PrevWater"], "Room"].tolist()
    if electric_rooms:
        warnings.append(f"Số điện mới nhỏ hơn số cũ: {', '.join(electric_rooms)}")
    if water_rooms:
        warnings.append(f"Số nước mới nhỏ hơn số cũ: {', '.join(water_rooms)}")
    return warnings


def compute_billing(df: pd.DataFrame, prices: UnitPrices) -> pd.DataFrame:
    df = normalize_columns(df).copy()
    df["Room"] = df["Room"].fillna("").astype(str).str.strip()
    df = df[df["Room"] != ""].copy()

    water_fixed_has_override = df["WaterFixedOverride"].notna() & (df["WaterFixedOverride"].astype(str).str.strip() != "")
    trash_has_override = df["TrashOverride"].notna() & (df["TrashOverride"].astype(str).str.strip() != "")
    light_has_override = df["LightOverride"].notna() & (df["LightOverride"].astype(str).str.strip() != "")

    df = coerce_numeric(df, NUMERIC_COLUMNS)

    df["ElectricUsage"] = (df["NewElectric"] - df["PrevElectric"]).clip(lower=0)
    df["ElectricCost"] = df["ElectricUsage"] * prices.electric_price

    water_type = df["WaterCalcType"].fillna("m3").astype(str).str.lower().str.strip()
    water_m3_cost = (df["NewWater"] - df["PrevWater"]).clip(lower=0) * prices.water_price_m3
    water_people_cost = df["PeopleCount"] * prices.water_price_person
    water_fixed_cost = df["WaterFixedOverride"].where(water_fixed_has_override, prices.water_fixed)

    df["WaterCost"] = 0.0
    df.loc[water_type == "m3", "WaterCost"] = water_m3_cost
    df.loc[water_type == "people", "WaterCost"] = water_people_cost
    df.loc[water_type == "fixed", "WaterCost"] = water_fixed_cost

    df["TrashFee"] = df["TrashOverride"].where(trash_has_override, prices.trash_fee)
    df["LightFee"] = df["LightOverride"].where(light_has_override, prices.light_fee)
    df["Total"] = (
        df["RoomPrice"]
        + df["ElectricCost"]
        + df["WaterCost"]
        + df["TrashFee"]
        + df["LightFee"]
        + df["ExtraCharge"]
    )
    return df


def summarize_month(df: pd.DataFrame) -> dict[str, float | int]:
    df = normalize_columns(df)
    df = coerce_numeric(df, NUMERIC_COLUMNS)
    df["ElectricUsage"] = (df["NewElectric"] - df["PrevElectric"]).clip(lower=0)
    water_cost_total = float(df["WaterCost"].sum()) if "WaterCost" in df.columns else 0.0
    total_amount = float(df["Total"].sum()) if "Total" in df.columns else float(df["RoomPrice"].sum())
    return {
        "rooms": int(df["Room"].nunique()),
        "total": total_amount,
        "electric_usage": float(df["ElectricUsage"].sum()),
        "water_cost": water_cost_total,
    }


def get_previous_month_label(month_label: str) -> str | None:
    month_label = month_label.strip()
    try:
        current_date = date.fromisoformat(f"{month_label}-01")
    except ValueError:
        return None
    prev_month = current_date.replace(day=1)
    if prev_month.month == 1:
        prev_month = prev_month.replace(year=prev_month.year - 1, month=12)
    else:
        prev_month = prev_month.replace(month=prev_month.month - 1)
    return prev_month.strftime("%Y-%m")


def is_valid_month_label(month_label: str) -> bool:
    try:
        date.fromisoformat(f"{month_label}-01")
    except ValueError:
        return False
    return True


def build_base_from_previous(prev_df: pd.DataFrame) -> pd.DataFrame:
    prev_df = normalize_columns(prev_df)
    prev_df = coerce_numeric(prev_df, ["NewElectric", "NewWater", "PeopleCount", "RoomPrice", "TrashOverride", "LightOverride", "WaterFixedOverride"])
    base_df = prev_df.copy()
    base_df["PrevElectric"] = prev_df["NewElectric"]
    base_df["PrevWater"] = prev_df["NewWater"]
    base_df["NewElectric"] = None
    base_df["NewWater"] = None
    base_df["ExtraCharge"] = 0
    base_df["ExtraNote"] = ""
    return base_df[EXPECTED_COLUMNS]


def build_base_from_rooms(rooms_df: pd.DataFrame) -> pd.DataFrame:
    rooms_df = normalize_room_columns(rooms_df)
    rooms_df = coerce_numeric(rooms_df, ["PeopleCount", "RoomPrice"])
    rooms_df["Active"] = rooms_df["Active"].fillna(True).astype(bool)
    rooms_df = rooms_df[rooms_df["Active"]].copy()
    base_df = pd.DataFrame(columns=EXPECTED_COLUMNS)
    base_df["Room"] = rooms_df["Room"]
    base_df["PrevElectric"] = 0
    base_df["NewElectric"] = None
    base_df["PrevWater"] = 0
    base_df["NewWater"] = None
    base_df["WaterCalcType"] = rooms_df["WaterCalcType"].fillna("m3")
    base_df["PeopleCount"] = rooms_df["PeopleCount"]
    base_df["RoomPrice"] = rooms_df["RoomPrice"]
    base_df["ExtraCharge"] = 0
    base_df["ExtraNote"] = ""
    base_df["TrashOverride"] = rooms_df["TrashOverride"]
    base_df["LightOverride"] = rooms_df["LightOverride"]
    base_df["WaterFixedOverride"] = rooms_df["WaterFixedOverride"]
    return base_df[EXPECTED_COLUMNS]


def unit_prices_to_dict(prices: UnitPrices) -> dict[str, float]:
    return {
        "electric_price": prices.electric_price,
        "water_price_m3": prices.water_price_m3,
        "water_price_person": prices.water_price_person,
        "water_fixed": prices.water_fixed,
        "trash_fee": prices.trash_fee,
        "light_fee": prices.light_fee,
    }


def unit_prices_from_row(row: dict) -> UnitPrices:
    defaults = unit_prices_to_dict(default_unit_prices())
    values = {}
    for key, default_value in defaults.items():
        value = row.get(key)
        values[key] = float(default_value if value in (None, "") else value)
    return UnitPrices(**values)


def to_excel_bytes(df: pd.DataFrame) -> bytes:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Billing")
    return buffer.getvalue()


def to_csv_bytes(df: pd.DataFrame) -> bytes:
    return df.to_csv(index=False).encode("utf-8-sig")
