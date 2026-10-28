from fastapi.testclient import TestClient
from api import app
from attendance import create_session, get_user_by_username

client = TestClient(app)

# 1. Test unauthenticated /practices
r = client.get("/practices")
print("Unauthenticated /practices:", r.status_code, r.json())

# 2. Test Admin login & access
admin_user = get_user_by_username("admin")
token_admin = create_session("admin", "admin", "ALL")
headers_admin = {"Authorization": f"Bearer {token_admin}"}

r_admin_prac = client.get("/practices", headers=headers_admin)
print("Admin /practices:", r_admin_prac.status_code, r_admin_prac.json())

r_admin_emps = client.get("/employees", headers=headers_admin)
print("Admin /employees count:", len(r_admin_emps.json()))
assert len(r_admin_emps.json()) == 7, f"Expected 7 employees for admin, got {len(r_admin_emps.json())}"

# 3. Test Superior login & access
token_sup = create_session("superior", "superior", "ALL")
headers_sup = {"Authorization": f"Bearer {token_sup}"}
r_sup_emps = client.get("/employees", headers=headers_sup)
print("Superior /employees count:", len(r_sup_emps.json()))
assert len(r_sup_emps.json()) == 7, f"Expected 7 employees for superior, got {len(r_sup_emps.json())}"

# 4. Test HR Saradhi Prathi (sprathi)
token_saradhi = create_session("sprathi", "hr", "Software Services")
headers_saradhi = {"Authorization": f"Bearer {token_saradhi}"}

r_saradhi_prac = client.get("/practices", headers=headers_saradhi)
print("Saradhi /practices:", r_saradhi_prac.status_code, r_saradhi_prac.json())
assert set(r_saradhi_prac.json()) == {"Cloud Services", "Software Services"}, f"Expected Cloud Services and Software Services, got {r_saradhi_prac.json()}"

r_saradhi_all = client.get("/employees", headers=headers_saradhi)
print("Saradhi All Employees count:", len(r_saradhi_all.json()), [e["employee_id"] for e in r_saradhi_all.json()])
assert len(r_saradhi_all.json()) == 3, f"Expected 3 employees for Saradhi, got {len(r_saradhi_all.json())}"

r_saradhi_cloud = client.get("/employees?practice=Cloud+Services", headers=headers_saradhi)
print("Saradhi Cloud Services:", [e["employee_id"] for e in r_saradhi_cloud.json()])
assert len(r_saradhi_cloud.json()) == 1 and r_saradhi_cloud.json()[0]["employee_id"] == "9614"

r_saradhi_software = client.get("/employees?practice=Software+Services", headers=headers_saradhi)
print("Saradhi Software Services:", [e["employee_id"] for e in r_saradhi_software.json()])
assert len(r_saradhi_software.json()) == 2 and {e["employee_id"] for e in r_saradhi_software.json()} == {"9615", "9616"}

# 5. Direct access check: Saradhi attempting to fetch Lohitha's employee 9608
r_forbidden = client.get("/employees/9608", headers=headers_saradhi)
print("Saradhi accessing Lohitha employee 9608:", r_forbidden.status_code)
assert r_forbidden.status_code == 403, f"Expected 403 for unauthorized employee access, got {r_forbidden.status_code}"

# 6. Test HR Lohitha Bondi (lbondi)
token_lohitha = create_session("lbondi", "hr", "Innovation")
headers_lohitha = {"Authorization": f"Bearer {token_lohitha}"}

r_lohitha_prac = client.get("/practices", headers=headers_lohitha)
print("Lohitha /practices:", r_lohitha_prac.status_code, r_lohitha_prac.json())
assert set(r_lohitha_prac.json()) == {"Innovation", "Software Services"}

r_lohitha_all = client.get("/employees", headers=headers_lohitha)
print("Lohitha All Employees:", [e["employee_id"] for e in r_lohitha_all.json()])
assert len(r_lohitha_all.json()) == 3 and {e["employee_id"] for e in r_lohitha_all.json()} == {"9608", "6028", "6029"}

r_lohitha_inno = client.get("/employees?practice=Innovation", headers=headers_lohitha)
print("Lohitha Innovation Employees:", [e["employee_id"] for e in r_lohitha_inno.json()])
assert len(r_lohitha_inno.json()) == 1 and r_lohitha_inno.json()[0]["employee_id"] == "6028"

# 7. Lohitha attempting to access Saradhi's employee 9615
r_forbidden_2 = client.get("/employees/9615", headers=headers_lohitha)
print("Lohitha accessing Saradhi employee 9615:", r_forbidden_2.status_code)
assert r_forbidden_2.status_code == 403

# 8. Test HR with 0 employees (e.g. hr_training)
token_training = create_session("hr_training", "hr", "Software Training")
headers_training = {"Authorization": f"Bearer {token_training}"}
r_training_prac = client.get("/practices", headers=headers_training)
print("hr_training /practices:", r_training_prac.json())
assert r_training_prac.json() == []

r_training_emps = client.get("/employees", headers=headers_training)
print("hr_training /employees:", r_training_emps.json())
assert r_training_emps.json() == []

print("\nALL BACKEND ROLE-BASED TESTS PASSED SUCCESSFULLY!")
