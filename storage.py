from __future__ import annotations

import pandas as pd
from supabase import Client

from billing import UnitPrices, unit_prices_from_row, unit_prices_to_dict


BILLING_TABLE_NAME = "billing_history"
UNIT_PRICE_TABLE_NAME = "unit_prices"
ROOM_TABLE_NAME = "rooms"


class StorageError(RuntimeError):
    pass


class MissingTableError(StorageError):
    pass


def _data(response):
    return getattr(response, "data", None)


def _json_value(value):
    if pd.isna(value):
        return None
    return value


def _is_missing_table_error(exc: Exception, table_name: str) -> bool:
    message = str(exc)
    return "PGRST205" in message or f"public.{table_name}" in message and "schema cache" in message


def _is_missing_column_error(exc: Exception, column_name: str) -> bool:
    message = str(exc)
    return column_name in message and ("PGRST204" in message or "column" in message or "schema cache" in message)


def list_history_sheets(client: Client) -> list[str]:
    try:
        response = client.table(BILLING_TABLE_NAME).select("month").order("month", desc=True).execute()
    except Exception as exc:
        raise StorageError(f"Không đọc được lịch sử: {exc}") from exc

    rows = _data(response)
    if not rows:
        return []
    return [row["month"] for row in rows if row.get("month")]


def load_history_sheet(client: Client, sheet_name: str) -> tuple[pd.DataFrame, UnitPrices | None]:
    if not sheet_name:
        return pd.DataFrame(), None

    try:
        response = client.table(BILLING_TABLE_NAME).select("data, unit_prices").eq("month", sheet_name).maybe_single().execute()
    except Exception as exc:
        if not _is_missing_column_error(exc, "unit_prices"):
            raise StorageError(f"Không đọc được lịch sử tháng {sheet_name}: {exc}") from exc
        try:
            response = client.table(BILLING_TABLE_NAME).select("data").eq("month", sheet_name).maybe_single().execute()
        except Exception as fallback_exc:
            raise StorageError(f"Không đọc được lịch sử tháng {sheet_name}: {fallback_exc}") from fallback_exc

    row = _data(response)
    if not row:
        return pd.DataFrame(), None

    prices = unit_prices_from_row(row.get("unit_prices") or {}) if row.get("unit_prices") else None
    return pd.DataFrame(row.get("data") or []), prices


def history_exists(client: Client, sheet_name: str) -> bool:
    if not sheet_name:
        return False
    try:
        response = client.table(BILLING_TABLE_NAME).select("month").eq("month", sheet_name).maybe_single().execute()
    except Exception as exc:
        raise StorageError(f"Không kiểm tra được lịch sử tháng {sheet_name}: {exc}") from exc
    return bool(_data(response))


def save_history_sheet(client: Client, sheet_name: str, df: pd.DataFrame, prices: UnitPrices) -> None:
    rows = [
        {key: _json_value(value) for key, value in row.items()}
        for row in df.to_dict(orient="records")
    ]
    payload = {
        "month": sheet_name,
        "data": rows,
        "unit_prices": unit_prices_to_dict(prices),
    }
    try:
        client.table(BILLING_TABLE_NAME).upsert(payload).execute()
    except Exception as exc:
        if not _is_missing_column_error(exc, "unit_prices"):
            raise StorageError(f"Không lưu được lịch sử: {exc}") from exc
        fallback_payload = {
            "month": payload["month"],
            "data": payload["data"],
        }
        try:
            client.table(BILLING_TABLE_NAME).upsert(fallback_payload).execute()
        except Exception as fallback_exc:
            raise StorageError(f"Không lưu được lịch sử: {fallback_exc}") from fallback_exc


def delete_history_sheet(client: Client, sheet_name: str) -> None:
    try:
        client.table(BILLING_TABLE_NAME).delete().eq("month", sheet_name).execute()
    except Exception as exc:
        raise StorageError(f"Không xóa được lịch sử tháng {sheet_name}: {exc}") from exc


def load_unit_prices(client: Client, month_label: str) -> UnitPrices | None:
    if not month_label:
        return None

    try:
        response = client.table(UNIT_PRICE_TABLE_NAME).select("*").eq("month", month_label).maybe_single().execute()
    except Exception as exc:
        raise StorageError(f"Không đọc được bảng đơn giá: {exc}") from exc

    row = _data(response)
    if not row:
        return None
    return unit_prices_from_row(row)


def save_unit_prices(client: Client, month_label: str, prices: UnitPrices) -> None:
    payload = {"month": month_label, **unit_prices_to_dict(prices)}
    try:
        client.table(UNIT_PRICE_TABLE_NAME).upsert(payload).execute()
    except Exception as exc:
        raise StorageError(f"Không lưu được đơn giá: {exc}") from exc


def load_rooms(client: Client) -> pd.DataFrame:
    try:
        response = client.table(ROOM_TABLE_NAME).select("*").order("room").execute()
    except Exception as exc:
        if _is_missing_table_error(exc, ROOM_TABLE_NAME):
            raise MissingTableError("Chưa có bảng rooms. Hãy chạy file supabase_schema.sql trong Supabase SQL Editor.") from exc
        raise StorageError(f"Không đọc được danh sách phòng: {exc}") from exc

    rows = _data(response)
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(
        [
            {
                "Room": row.get("room"),
                "WaterCalcType": row.get("water_calc_type"),
                "PeopleCount": row.get("people_count"),
                "RoomPrice": row.get("room_price"),
                "TrashOverride": row.get("trash_override"),
                "LightOverride": row.get("light_override"),
                "WaterFixedOverride": row.get("water_fixed_override"),
                "Active": row.get("active", True),
            }
            for row in rows
        ]
    )


def save_rooms(client: Client, rooms_df: pd.DataFrame) -> None:
    payload = []
    for row in rooms_df.to_dict(orient="records"):
        row = {key: _json_value(value) for key, value in row.items()}
        room = str(row.get("Room") or "").strip()
        if not room:
            continue
        payload.append(
            {
                "room": room,
                "water_calc_type": row.get("WaterCalcType") or "m3",
                "people_count": row.get("PeopleCount") or 0,
                "room_price": row.get("RoomPrice") or 0,
                "trash_override": row.get("TrashOverride"),
                "light_override": row.get("LightOverride"),
                "water_fixed_override": row.get("WaterFixedOverride"),
                "active": bool(row.get("Active", True)),
            }
        )

    if not payload:
        return

    try:
        client.table(ROOM_TABLE_NAME).upsert(payload).execute()
    except Exception as exc:
        if _is_missing_table_error(exc, ROOM_TABLE_NAME):
            raise MissingTableError("Chưa có bảng rooms. Hãy chạy file supabase_schema.sql trong Supabase SQL Editor.") from exc
        raise StorageError(f"Không lưu được danh sách phòng: {exc}") from exc
