from fastapi.testclient import TestClient
from api import app
from attendance import create_session

client = TestClient(app)

token_saradhi = create_session("sprathi", "hr", "Software Services")
headers_saradhi = {"Authorization": f"Bearer {token_saradhi}"}

token_admin = create_session("admin", "admin", "ALL")
headers_admin = {"Authorization": f"Bearer {token_admin}"}

# 1. Today's attendance for Saradhi
r_att_saradhi = client.get("/attendance/today", headers=headers_saradhi)
print("Saradhi today attendance count:", len(r_att_saradhi.json()))
assert len(r_att_saradhi.json()) == 3, f"Expected 3, got {len(r_att_saradhi.json())}"

# 2. Today's attendance for Saradhi with practice=Cloud Services
r_att_cloud = client.get("/attendance/today?practice=Cloud+Services", headers=headers_saradhi)
print("Saradhi Cloud Services today attendance count:", len(r_att_cloud.json()))
assert len(r_att_cloud.json()) == 1 and r_att_cloud.json()[0]["employee_id"] == "9614"

# 3. Today's attendance for Admin
r_att_admin = client.get("/attendance/today", headers=headers_admin)
print("Admin today attendance count:", len(r_att_admin.json()))
assert len(r_att_admin.json()) == 7, f"Expected 7, got {len(r_att_admin.json())}"

# 4. Reports preview EOD for Saradhi
r_eod_saradhi = client.get("/reports/preview/eod?date=2026-10-23", headers=headers_saradhi)
print("Saradhi EOD preview status:", r_eod_saradhi.status_code)
assert r_eod_saradhi.status_code == 200

# 5. Reports preview arrival status for Saradhi
r_arr_saradhi = client.get("/reports/preview/arrival-status?date=2026-10-23", headers=headers_saradhi)
print("Saradhi arrival preview status:", r_arr_saradhi.status_code)
assert r_arr_saradhi.status_code == 200

# 6. Excel report download for Saradhi
r_rep_saradhi = client.get("/reports/attendance?period=monthly&date=2026-10-23", headers=headers_saradhi)
print("Saradhi report download status:", r_rep_saradhi.status_code)
assert r_rep_saradhi.status_code == 200

print("\nALL ATTENDANCE AND REPORTING TESTS PASSED SUCCESSFULLY!")
