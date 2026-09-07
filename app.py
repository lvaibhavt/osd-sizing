from __future__ import annotations

import json
import os
from decimal import Decimal, ROUND_HALF_UP
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).parent
CATALOG_PATH = ROOT / "price_catalog.json"


def catalog() -> dict:
    with CATALOG_PATH.open(encoding="utf-8") as source:
        return json.load(source)


def number(payload: dict, key: str, minimum: float = 0) -> float:
    try:
        value = float(payload[key])
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError(f"{key.replace('_', ' ').title()} is required.") from error
    if value < minimum:
        raise ValueError(f"{key.replace('_', ' ').title()} must be at least {minimum}.")
    return value


def money(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def calculate(payload: dict) -> dict:
    prices = catalog()
    desktops = int(number(payload, "desktops", 1))
    ocpus = number(payload, "ocpus", 1)
    memory_gb = number(payload, "memory_gb", 1)
    boot_gb = number(payload, "boot_gb", 50)
    data_gb = number(payload, "data_gb", 0)
    vpus = number(payload, "vpus", 0)
    hours = number(payload, "hours_per_month", 0)
    shape_name = payload.get("shape")
    shape = prices["shapes"].get(shape_name)
    if not shape:
        raise ValueError("Select a supported OCI shape.")
    if ocpus < shape["min_ocpus"]:
        raise ValueError(f"{shape_name} requires at least {shape['min_ocpus']} OCPU.")
    if memory_gb > ocpus * shape["max_memory_per_ocpu"]:
        raise ValueError("Memory exceeds this shape's supported memory-per-OCPU limit.")

    billable_desktops = max(desktops, 10)
    storage_gb_per_desktop = boot_gb + data_gb
    service = billable_desktops * prices["secure_desktop_monthly"]
    compute = desktops * hours * (ocpus * shape["ocpu_hourly"] + memory_gb * shape["memory_gb_hourly"])
    storage_capacity = desktops * storage_gb_per_desktop * prices["block_volume_gb_monthly"]
    storage_performance = desktops * storage_gb_per_desktop * vpus * prices["block_volume_performance_vpu_gb_monthly"]
    monthly = service + compute + storage_capacity + storage_performance
    configured = all(amount > 0 for amount in (shape["ocpu_hourly"], shape["memory_gb_hourly"], prices["block_volume_gb_monthly"], prices["block_volume_performance_vpu_gb_monthly"]))
    return {
        "currency": prices["currency"], "region_label": prices["region_label"], "configured": configured,
        "summary": {"desktops": desktops, "billable_desktops": billable_desktops, "monthly": money(monthly), "annual": money(monthly * 12), "three_year": money(monthly * 36)},
        "line_items": [
            {"name": "OCI Secure Desktops service", "monthly": money(service), "detail": f"{billable_desktops} desktop(s) billed (10-desktop minimum)"},
            {"name": "Compute", "monthly": money(compute), "detail": f"{desktops} × {ocpus:g} OCPU, {memory_gb:g} GB × {hours:g} hours"},
            {"name": "Block volume capacity", "monthly": money(storage_capacity), "detail": f"{desktops} × {storage_gb_per_desktop:g} GB (boot + optional desktop storage)"},
            {"name": "Block volume performance", "monthly": money(storage_performance), "detail": f"{desktops} × {storage_gb_per_desktop:g} GB × {vpus:g} VPUs"},
        ],
    }


class SizingHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def json_response(self, body: dict, status: int = HTTPStatus.OK) -> None:
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/catalog":
            self.json_response(catalog())
            return
        if path == "/":
            self.path = "/templates/index.html"
        super().do_GET()

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/estimate":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(size).decode("utf-8"))
            self.json_response(calculate(payload))
        except (ValueError, json.JSONDecodeError) as error:
            self.json_response({"error": str(error)}, HTTPStatus.BAD_REQUEST)


if __name__ == "__main__":
    port = int(os.environ.get("OSD_SIZING_PORT", "5059"))
    server = ThreadingHTTPServer(("127.0.0.1", port), SizingHandler)
    print(f"OSD Sizing Tool is running at http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()
