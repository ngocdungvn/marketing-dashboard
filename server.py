"""
DigiDash Server - HTTP + REST API + Report Scheduler
Serves static files and provides API for email report scheduling.
Run: python server.py
"""

import http.server
import json
import os
import smtplib
import ssl
import threading
import time
import urllib.request
import csv
import io
import re
import calendar
from http.server import HTTPServer, SimpleHTTPRequestHandler
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta, date
from pathlib import Path

PORT = 8081
BASE_DIR = Path(__file__).parent
SCHEDULES_FILE = BASE_DIR / "schedules.json"
CONFIG_FILE = BASE_DIR / "email_config.json"


def load_json(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default if default is not None else {}


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_email_config():
    return load_json(CONFIG_FILE, {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_user": "",
        "smtp_pass": "",
        "display_name": "DigiDash Report"
    })


def get_schedules():
    return load_json(SCHEDULES_FILE, [])


# ============================================
# Report Generator
# ============================================

SHEET_URLS = {
    "overview": "https://docs.google.com/spreadsheets/d/1MGVtHY3E85b27TybFvjFX_eXLssbLFxeQ2h8XdJnOuM/gviz/tq?tqx=out:csv&sheet=Input",
    "facebook": "https://docs.google.com/spreadsheets/d/1r5pJNWK5wECSHSNokU6LyBYmu4SxXauh9wjGwVml2XM/gviz/tq?tqx=out:csv&sheet=Input",
    "fbmessage": "https://docs.google.com/spreadsheets/d/17ZLBmaWH-TQPqv3CooheS3Pl1kT8Tdn3aPf2HUphZZA/gviz/tq?tqx=out:csv&sheet=Input",
}

PAGE_NAMES = {
    "overview": "Tong quan Digital Marketing",
    "facebook": "FB Ads Chuyen doi",
    "fbmessage": "FB Ads Tin nhan",
    "google": "Google Ads Performance",
    "tiktok": "TikTok Ads Performance",
    "kpi": "KPIs Nhan su",
    "content": "Content Plan",
    "tasks": "Task Management",
}

SLUG_MAP = {
    "overview": "tong-quan",
    "facebook": "fb-chuyen-doi",
    "fbmessage": "fb-tin-nhan",
    "google": "google-ads",
    "tiktok": "tiktok-ads",
    "kpi": "kpi",
    "content": "content-plan",
    "tasks": "tasks",
}


# ============================================
# Date Range Calculation
# ============================================

def compute_report_range(frequency, ref_date=None):
    """Compute the date range for a report based on frequency.
    Weekly: Monday - Sunday of the current/ref week.
    Monthly: 1st - last day of the current/ref month.
    Returns (start_date, end_date) as date objects.
    """
    ref = ref_date or date.today()
    if frequency == "weekly":
        start = ref - timedelta(days=ref.weekday())   # Monday
        end = start + timedelta(days=6)                 # Sunday
    elif frequency == "monthly":
        start = ref.replace(day=1)
        last_day = calendar.monthrange(ref.year, ref.month)[1]
        end = ref.replace(day=last_day)
    else:
        # manual / send-now: last 30 days
        end = ref
        start = ref - timedelta(days=30)
    return start, end


def parse_vn_date(text):
    """Parse Vietnamese D/M/YY or D/M/YYYY date string.
    Google Sheets Vietnamese locale exports dates as D/M/YY.
    Returns a date object or None.
    """
    if not text or not isinstance(text, str):
        return None
    text = text.strip()
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{2,4})$', text)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if year < 100:
            year += 2000
        try:
            return date(year, month, day)
        except ValueError:
            return None
    return None


def row_in_range(row, start_date, end_date):
    """Check if a data row falls within the date range.
    Checks multiple possible date columns in priority order.
    """
    date_cols = ["ngay", "Ngay", "ngayBatDau", "Ngay bat dau",
                 "deadline", "Deadline", "ngayGiao", "Ngay giao"]

    for col in date_cols:
        val = row.get(col, "").strip()
        if val:
            d = parse_vn_date(val)
            if d:
                return start_date <= d <= end_date

    # Try ngayBatDau + ngayKetThuc range overlap
    start_val = row.get("ngayBatDau", "") or row.get("Ngay bat dau", "")
    end_val = row.get("ngayKetThuc", "") or row.get("Ngay ket thuc", "")
    if start_val and end_val:
        ds = parse_vn_date(start_val.strip())
        de = parse_vn_date(end_val.strip())
        if ds and de:
            return ds <= end_date and de >= start_date  # range overlap

    return True  # no date column found, include the row


def format_range_vn(start_date, end_date):
    """Format date range in Vietnamese style."""
    return f"{start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}"


def fetch_csv_data(url, max_rows=200, date_range=None):
    """Fetch CSV from Google Sheets and return list of dicts.
    If date_range is provided as (start_date, end_date), filter rows.
    """
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DigiDash/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            text = resp.read().decode("utf-8")
        reader = csv.reader(io.StringIO(text))
        headers = next(reader, [])
        rows = []
        for row in reader:
            if not any(cell.strip() for cell in row[1:5]):
                continue  # skip empty rows
            row_dict = dict(zip(headers, row))
            if date_range:
                if not row_in_range(row_dict, date_range[0], date_range[1]):
                    continue
            rows.append(row_dict)
            if len(rows) >= max_rows:
                break
        return headers, rows
    except Exception as e:
        print(f"[CSV] Error fetching {url}: {e}")
        return [], []


def generate_report_html(page, base_url="http://localhost:8081",
                         frequency=None, date_range=None, to_emails=None):
    """Generate HTML email content for a specific dashboard page.
    frequency: 'weekly' | 'monthly' | None (manual)
    date_range: (start_date, end_date) tuple or None
    to_emails: list of recipient email addresses for display
    """
    page_name = PAGE_NAMES.get(page, page)
    slug = SLUG_MAP.get(page, page)
    dashboard_link = f"{base_url}/#/{slug}"
    now = datetime.now().strftime("%d/%m/%Y %H:%M")
    config = get_email_config()
    sender_name = config.get("display_name", "DigiDash")

    # Compute date range if not provided
    if date_range is None and frequency:
        date_range = compute_report_range(frequency)

    # Build period label and description
    period_label = ""
    period_desc = ""
    start_full = ""
    end_full = ""
    subject_line = ""

    if date_range:
        start_full = date_range[0].strftime("%d/%m/%Y")
        end_full = date_range[1].strftime("%d/%m/%Y")
        start_short = date_range[0].strftime("%d/%m")
        end_short = date_range[1].strftime("%d/%m")

        if frequency == "weekly":
            subject_line = f"B\u00e1o c\u00e1o c\u00f4ng vi\u1ec7c Marketing tu\u1ea7n {start_short} - {end_short}"
            period_desc = (
                f"B\u00e1o c\u00e1o t\u1ed5ng h\u1ee3p c\u00f4ng vi\u1ec7c trong tu\u1ea7n t\u1eeb ng\u00e0y "
                f"<b>{start_full}</b> \u0111\u1ebfn ng\u00e0y <b>{end_full}</b>."
            )
        elif frequency == "monthly":
            subject_line = (
                f"B\u00e1o c\u00e1o c\u00f4ng vi\u1ec7c Marketing "
                f"th\u00e1ng {date_range[0].month}/{date_range[0].year}"
            )
            period_desc = (
                f"B\u00e1o c\u00e1o t\u1ed5ng h\u1ee3p th\u00e1ng "
                f"{date_range[0].month}/{date_range[0].year}, "
                f"t\u1eeb ng\u00e0y <b>{start_full}</b> \u0111\u1ebfn ng\u00e0y <b>{end_full}</b>."
            )
        else:
            subject_line = f"B\u00e1o c\u00e1o {page_name} ({start_short} - {end_short})"
            period_desc = (
                f"B\u00e1o c\u00e1o d\u1eef li\u1ec7u t\u1eeb ng\u00e0y "
                f"<b>{start_full}</b> \u0111\u1ebfn ng\u00e0y <b>{end_full}</b>."
            )
    else:
        subject_line = f"B\u00e1o c\u00e1o {page_name}"
        period_desc = "B\u00e1o c\u00e1o t\u1ed5ng h\u1ee3p to\u00e0n b\u1ed9 d\u1eef li\u1ec7u hi\u1ec7n c\u00f3."

    # Fetch and filter data
    summary_rows = ""
    total_count = 0
    sheet_url = SHEET_URLS.get(page)
    if sheet_url:
        headers, rows = fetch_csv_data(sheet_url, max_rows=200, date_range=date_range)
        total_count = len(rows)
        if rows and headers:
            display_headers = headers[:8]
            header_cells = "".join(
                f'<th style="padding:8px 12px;text-align:left;background:#f1f5f9;'
                f'border-bottom:2px solid #e2e8f0;font-size:12px;color:#475569;'
                f'white-space:nowrap;">{h}</th>' for h in display_headers
            )
            data_rows = ""
            for row in rows[:20]:
                cells = "".join(
                    f'<td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;'
                    f'font-size:12px;color:#334155;white-space:nowrap;">'
                    f'{row.get(h, "")}</td>' for h in display_headers
                )
                data_rows += f"<tr>{cells}</tr>"
            summary_rows = f"""
            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-family:Inter,Arial,sans-serif;">
                <thead><tr>{header_cells}</tr></thead>
                <tbody>{data_rows}</tbody>
            </table>
            <p style="color:#94a3b8;font-size:11px;margin:4px 0;">
                Hi\u1ec3n th\u1ecb {min(total_count, 20)}/{total_count} d\u00f2ng d\u1eef li\u1ec7u trong k\u1ef3.
            </p>
            """

    # Recipient pill badges
    recipient_badges = ""
    if to_emails:
        badges = "".join(
            f'<span style="border:1px solid #dadce0;border-radius:24px;'
            f'display:inline-block;padding:5px 15px;margin:0 4px 6px 4px;'
            f'font-size:14px;color:#3c4043;font-weight:500;">{email}</span>'
            for email in to_emails
        )
        recipient_badges = f'<div style="margin-bottom:24px;">{badges}</div>'

    logo_url = "https://www.gstatic.com/images/branding/product/1x/sheets_2020q4_48dp.png"

    # Build data table if available
    data_table_html = ""
    if summary_rows:
        data_table_html = f"""
        <div style="text-align:left; margin: 30px 0 20px 0;">
            <h3 style="color:#202124; font-size:16px; font-weight:500; margin:0 0 10px 0;">
                D\u1eef li\u1ec7u trong k\u1ef3 ({total_count} b\u1ea3n ghi)
            </h3>
            <div style="overflow-x:auto; border:1px solid #dadce0; border-radius:8px;">
                {summary_rows}
            </div>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Roboto',Helvetica,Arial,sans-serif;">
<div style="background-color:#f0f4f8;padding:40px 0;">
  <div style="max-width:580px;margin:0 auto;background-color:#ffffff;border:1px solid #dadce0;border-radius:8px;padding:40px 30px;text-align:center;box-shadow:0 2px 5px rgba(0,0,0,0.05);">

    <img src="{logo_url}" width="48" style="margin-bottom:20px;">

    <h2 style="color:#202124;font-size:24px;font-weight:400;margin:0 0 20px 0;">
      {subject_line}
    </h2>

    {recipient_badges}

    <p style="font-size:16px;line-height:1.6;color:#3c4043;text-align:left;margin-bottom:30px;">
      {period_desc}<br><br>
      File b\u00e1o c\u00e1o chi ti\u1ebft (PDF) \u0111\u00e3 \u0111\u01b0\u1ee3c \u0111\u00ednh k\u00e8m b\u00ean d\u01b0\u1edbi email n\u00e0y.
      Anh vui l\u00f2ng t\u1ea3i v\u1ec1 \u0111\u1ec3 xem, ho\u1eb7c b\u1ea5m v\u00e0o link \u0111\u1ec3 xem chi ti\u1ebft.
    </p>

    <a href="{dashboard_link}" style="display:inline-block;background-color:#1a73e8;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:4px;font-weight:500;font-size:14px;letter-spacing:0.25px;">
      Ki\u1ec3m tra b\u1ea3ng t\u00ednh
    </a>

    <hr style="border:0;border-top:1px solid #dadce0;margin:40px 0 20px 0;">
    <p style="font-size:12px;color:#70757a;line-height:1.5;">
      Email n\u00e0y \u0111\u01b0\u1ee3c g\u1eedi t\u1ef1 \u0111\u1ed9ng b\u1edfi {sender_name}.<br>
      Th\u1eddi gian g\u1eedi: {now}
    </p>

  </div>
</div>
</body>
</html>"""
    return html, subject_line



def send_email(to_emails, subject, html_body):
    """Send HTML email via SMTP."""
    config = get_email_config()
    if not config.get("smtp_user") or not config.get("smtp_pass"):
        return False, "Chua cau hinh email SMTP"

    try:
        msg = MIMEMultipart()
        msg["From"] = f'{config.get("display_name", "DigiDash")} <{config["smtp_user"]}>'
        msg["To"] = ", ".join(to_emails)
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        ctx = ssl.create_default_context()
        port = int(config.get("smtp_port", 587))
        host = config["smtp_host"]
        user = config["smtp_user"]
        password = config["smtp_pass"]

        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=ctx) as server:
                server.login(user, password)
                server.sendmail(user, to_emails, msg.as_string())
        else:
            with smtplib.SMTP(host, port) as server:
                server.starttls(context=ctx)
                server.login(user, password)
                server.sendmail(user, to_emails, msg.as_string())

        return True, "OK"
    except Exception as e:
        return False, str(e)


# ============================================
# Scheduler Thread
# ============================================

class ReportScheduler(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.running = True

    def run(self):
        print("[Scheduler] Started")
        while self.running:
            try:
                self.check_schedules()
            except Exception as e:
                print(f"[Scheduler] Error: {e}")
            time.sleep(60)  # check every minute

    def check_schedules(self):
        schedules = get_schedules()
        now = datetime.now()
        changed = False

        for sched in schedules:
            if not sched.get("enabled", True):
                continue
            if self.should_send(sched, now):
                page = sched.get("page", "overview")
                freq = sched.get("frequency", "weekly")
                emails = [e.strip() for e in sched.get("emails", "").split(",") if e.strip()]
                if emails:
                    dr = compute_report_range(freq, now.date())
                    html, subject = generate_report_html(
                        page, frequency=freq, date_range=dr, to_emails=emails
                    )
                    ok, msg = send_email(emails, subject, html)
                    range_str = format_range_vn(dr[0], dr[1])
                    sched["last_sent"] = now.isoformat()
                    sched["last_status"] = "OK" if ok else msg
                    changed = True
                    print(f"[Scheduler] Sent {page} [{range_str}] to {emails}: {msg}")

        if changed:
            save_json(SCHEDULES_FILE, schedules)

    def should_send(self, sched, now):
        last = sched.get("last_sent")
        if last:
            last_dt = datetime.fromisoformat(last)
            if (now - last_dt).total_seconds() < 3600:  # min 1 hour between sends
                return False

        freq = sched.get("frequency", "weekly")
        send_time = sched.get("time", "08:00")
        hour, minute = map(int, send_time.split(":"))

        if now.hour != hour or abs(now.minute - minute) > 1:
            return False

        if freq == "weekly":
            send_day = int(sched.get("day", 1))
            return now.weekday() == (send_day - 1) % 7
        elif freq == "monthly":
            send_day = int(sched.get("day", 1))
            return now.day == send_day
        return False


# ============================================
# HTTP Server with API
# ============================================

class DigiDashHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        if self.path == "/api/schedules":
            self.json_response(get_schedules())
        elif self.path == "/api/email-config":
            config = get_email_config()
            config["smtp_pass"] = "***" if config.get("smtp_pass") else ""
            self.json_response(config)
        else:
            super().do_GET()

    def do_POST(self):
        body = self.read_body()

        if self.path == "/api/email-config":
            current = get_email_config()
            for k in ["smtp_host", "smtp_port", "smtp_user", "display_name"]:
                if k in body:
                    current[k] = body[k]
            if body.get("smtp_pass") and body["smtp_pass"] != "***":
                current["smtp_pass"] = body["smtp_pass"]
            save_json(CONFIG_FILE, current)
            self.json_response({"ok": True})

        elif self.path == "/api/schedules":
            schedules = get_schedules()
            new_sched = {
                "id": int(time.time() * 1000),
                "page": body.get("page", "overview"),
                "frequency": body.get("frequency", "weekly"),
                "day": body.get("day", "1"),
                "time": body.get("time", "08:00"),
                "emails": body.get("emails", ""),
                "enabled": True,
                "last_sent": None,
                "last_status": None,
            }
            schedules.append(new_sched)
            save_json(SCHEDULES_FILE, schedules)
            self.json_response({"ok": True, "schedule": new_sched})

        elif self.path == "/api/send-now":
            page = body.get("page", "overview")
            freq = body.get("frequency")  # optional, from UI
            emails = [e.strip() for e in body.get("emails", "").split(",") if e.strip()]
            if not emails:
                self.json_response({"ok": False, "error": "Chua nhap email"}, 400)
                return
            # For manual send: use last 30 days range
            dr = compute_report_range(freq or "manual")
            html, subject = generate_report_html(
                page, frequency=freq, date_range=dr, to_emails=emails
            )
            ok, msg = send_email(emails, subject, html)
            self.json_response({"ok": ok, "message": msg})

        elif self.path == "/api/test-email":
            config = get_email_config()
            if not config.get("smtp_user"):
                self.json_response({"ok": False, "error": "Ch\u01b0a c\u1ea5u h\u00ecnh email"}, 400)
                return
            sender = config.get("display_name", "DigiDash")
            test_html = (
                f'<div style="font-family:Roboto,Arial,sans-serif;padding:40px;text-align:center;">'
                f'<h1 style="color:#1a73e8;">Email ho\u1ea1t \u0111\u1ed9ng!</h1>'
                f'<p style="font-size:16px;color:#3c4043;">'
                f'C\u1ea5u h\u00ecnh SMTP c\u1ee7a <b>{sender}</b> \u0111\u00e3 \u0111\u00fang.</p></div>'
            )
            ok, msg = send_email(
                [config["smtp_user"]],
                f"[{sender}] Ki\u1ec3m tra email",
                test_html
            )
            self.json_response({"ok": ok, "message": msg})

        else:
            self.json_response({"error": "Not found"}, 404)

    def do_PUT(self):
        body = self.read_body()
        if self.path.startswith("/api/schedules/"):
            sched_id = int(self.path.split("/")[-1])
            schedules = get_schedules()
            for s in schedules:
                if s["id"] == sched_id:
                    for k in ["page", "frequency", "day", "time", "emails", "enabled"]:
                        if k in body:
                            s[k] = body[k]
                    save_json(SCHEDULES_FILE, schedules)
                    self.json_response({"ok": True})
                    return
            self.json_response({"error": "Not found"}, 404)

    def do_DELETE(self):
        if self.path.startswith("/api/schedules/"):
            sched_id = int(self.path.split("/")[-1])
            schedules = get_schedules()
            schedules = [s for s in schedules if s["id"] != sched_id]
            save_json(SCHEDULES_FILE, schedules)
            self.json_response({"ok": True})
        else:
            self.json_response({"error": "Not found"}, 404)

    def read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    def json_response(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        try:
            msg = str(args[0]) if args else ""
            if "/api/" in msg:
                print(f"[API] {msg}")
        except Exception:
            pass


if __name__ == "__main__":
    # Init default files
    if not SCHEDULES_FILE.exists():
        save_json(SCHEDULES_FILE, [])
    if not CONFIG_FILE.exists():
        save_json(CONFIG_FILE, get_email_config())

    # Start scheduler
    scheduler = ReportScheduler()
    scheduler.start()

    # Start HTTP server
    server = HTTPServer(("0.0.0.0", PORT), DigiDashHandler)
    print(f"\n  [*] DigiDash Server running at http://localhost:{PORT}")
    print(f"  [*] Report scheduler active")
    print(f"  Press Ctrl+C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        scheduler.running = False
        server.shutdown()
