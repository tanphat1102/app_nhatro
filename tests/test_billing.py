import pandas as pd

from billing import UnitPrices, build_base_from_rooms, compute_billing, default_rooms, find_meter_warnings


def prices() -> UnitPrices:
    return UnitPrices(
        electric_price=3500,
        water_price_m3=15000,
        water_price_person=70000,
        water_fixed=120000,
        trash_fee=20000,
        light_fee=10000,
    )


def test_compute_m3_water_and_total():
    df = pd.DataFrame(
        [
            {
                "Room": "P1",
                "PrevElectric": 100,
                "NewElectric": 110,
                "PrevWater": 20,
                "NewWater": 23,
                "WaterCalcType": "m3",
                "PeopleCount": 0,
                "RoomPrice": 1000000,
                "ExtraCharge": 50000,
                "ExtraNote": "",
                "TrashOverride": None,
                "LightOverride": None,
                "WaterFixedOverride": None,
            }
        ]
    )

    result = compute_billing(df, prices())

    assert result.loc[0, "ElectricCost"] == 35000
    assert result.loc[0, "WaterCost"] == 45000
    assert result.loc[0, "Total"] == 1160000


def test_compute_people_and_fixed_water():
    df = pd.DataFrame(
        [
            {"Room": "P1", "WaterCalcType": "people", "PeopleCount": 2, "RoomPrice": 0},
            {"Room": "P2", "WaterCalcType": "fixed", "WaterFixedOverride": 90000, "RoomPrice": 0},
        ]
    )

    result = compute_billing(df, prices())

    assert result.loc[0, "WaterCost"] == 140000
    assert result.loc[1, "WaterCost"] == 90000


def test_zero_fee_override_is_respected():
    df = pd.DataFrame(
        [
            {
                "Room": "P1",
                "WaterCalcType": "fixed",
                "RoomPrice": 0,
                "TrashOverride": 0,
                "LightOverride": 0,
                "WaterFixedOverride": 0,
            }
        ]
    )

    result = compute_billing(df, prices())

    assert result.loc[0, "TrashFee"] == 0
    assert result.loc[0, "LightFee"] == 0
    assert result.loc[0, "WaterCost"] == 0


def test_blank_room_rows_are_ignored():
    df = pd.DataFrame(
        [
            {"Room": "", "RoomPrice": 1000000},
            {"Room": "P1", "RoomPrice": 2000000},
        ]
    )

    result = compute_billing(df, prices())

    assert result["Room"].tolist() == ["P1"]


def test_meter_warnings():
    df = pd.DataFrame(
        [
            {"Room": "P1", "PrevElectric": 20, "NewElectric": 10, "PrevWater": 4, "NewWater": 3},
        ]
    )

    warnings = find_meter_warnings(df)

    assert "Số điện mới nhỏ hơn số cũ: P1" in warnings
    assert "Số nước mới nhỏ hơn số cũ: P1" in warnings


def test_room_defaults_do_not_force_zero_fee_overrides():
    base_df = build_base_from_rooms(default_rooms())
    result = compute_billing(base_df, prices())

    assert result.loc[0, "TrashFee"] == 20000
    assert result.loc[0, "LightFee"] == 10000
