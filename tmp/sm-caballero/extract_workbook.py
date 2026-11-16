"""Read-only extraction of the SM Caballero source workbook to JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date, datetime, time
from pathlib import Path

import openpyxl


def serialize(value):
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    return value


def extract(source: Path) -> dict:
    formula_book = openpyxl.load_workbook(source, data_only=False, read_only=False)
    cached_book = openpyxl.load_workbook(source, data_only=True, read_only=False)
    sheets = []

    for formula_sheet in formula_book.worksheets:
        cached_sheet = cached_book[formula_sheet.title]
        rows = []
        formulas = {}
        cached_values = {}
        cell_types = {}
        number_formats = {}

        for cells in formula_sheet.iter_rows(
            min_row=1,
            max_row=formula_sheet.max_row,
            min_col=1,
            max_col=formula_sheet.max_column,
        ):
            row = []
            for cell in cells:
                value = cell.value
                if cell.data_type == "f":
                    formulas[cell.coordinate] = value
                    cached_values[cell.coordinate] = serialize(
                        cached_sheet[cell.coordinate].value
                    )
                    row.append(None)
                else:
                    row.append(serialize(value))
                if value is not None:
                    if isinstance(value, datetime):
                        cell_types[cell.coordinate] = "datetime"
                    elif isinstance(value, date):
                        cell_types[cell.coordinate] = "date"
                    elif isinstance(value, time):
                        cell_types[cell.coordinate] = "time"
                    else:
                        cell_types[cell.coordinate] = cell.data_type
                    if cell.number_format != "General":
                        number_formats[cell.coordinate] = cell.number_format
            rows.append(row)

        sheets.append(
            {
                "name": formula_sheet.title,
                "max_row": formula_sheet.max_row,
                "max_column": formula_sheet.max_column,
                "rows": rows,
                "formulas": formulas,
                "cached_values": cached_values,
                "cell_types": cell_types,
                "number_formats": number_formats,
                "merged_ranges": [
                    str(item) for item in formula_sheet.merged_cells.ranges
                ],
                "table_names": list(formula_sheet.tables),
                "charts_count": len(formula_sheet._charts),
                "freeze_panes": str(formula_sheet.freeze_panes)
                if formula_sheet.freeze_panes
                else None,
            }
        )

    return {
        "source_file": str(source),
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "format": "xlsx",
        "sheets": sheets,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    data = extract(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "source_sha256": data["source_sha256"],
                "sheets": [
                    {"name": s["name"], "rows": s["max_row"], "columns": s["max_column"]}
                    for s in data["sheets"]
                ],
            },
            ensure_ascii=False,
        )
    )
