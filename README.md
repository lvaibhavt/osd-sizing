# OCI Secure Desktops Sizer

A local planning dashboard for estimating an OCI Secure Desktops pool. It separates the Secure Desktops service fee, VM compute, block-volume capacity, and block-volume performance.

## Run locally

```bash
python3 app.py
```

Open `http://127.0.0.1:5059`.

No virtual environment or package installation is required; the tool uses only Python's built-in libraries. This avoids macOS shell-policy issues affecting the local `.venv` folder.

## Use the calculator

1. Set the desktop count and supported AMD flex shape.
2. Enter the OCPUs and memory allocated to each desktop.
3. Enter the C: / boot-volume size. Set **Persistent data drive** to `0` when no additional volume is required.
4. Select the block-volume performance level in VPUs per GB and enter the expected running hours per month.
5. Select **Calculate estimate**.

> Important: changing an input does not automatically refresh the estimate. Always select **Calculate estimate** after changing desktop count, compute, storage, VPUs, or runtime.

## What the estimate includes

- OCI Secure Desktops service: $20 per desktop per month, with a 10-desktop minimum.
- Shared VM compute: OCPU and memory consumption for the selected shape and runtime.
- Block-volume capacity and the selected block-volume performance (VPU) tier.

Windows is BYOL and Oracle Linux has no additional license cost. Dedicated Virtual Hosts, networking, backups, and any other ancillary OCI services are not included.

## Price data

The default catalog is configured for shared VMs and Windows BYOL (no DVH or OCI Windows license charge). Oracle Linux has no additional license cost. It includes the current Oracle global USD list prices used by the supported AMD flex shapes: E5 ($0.0300/OCPU-hour and $0.0020/GB-hour), E4 ($0.0250/OCPU-hour and $0.0015/GB-hour), block volume capacity ($0.0255/GB-month), variable block-volume performance ($0.0017/VPU-GB-month), and Secure Desktops ($20/desktop-month, with a 10-desktop minimum). Enter approved prices before choosing the Intel shape. Validate all figures against the OCI Cost Estimator before quoting.

This is a planning tool, not an Oracle quote or a replacement for the OCI Cost Estimator.
