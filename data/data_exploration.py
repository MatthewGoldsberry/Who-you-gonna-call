"""Basic Python script to find out some information about a couple of the columns that are getting colored."""

import csv
from pathlib import Path

path = Path(__file__).parent / "Cincinnati_311_(Non-Emergency)_Service_Requests_20260227.csv"

priorities = set()
departments = set()
neighborhoods = set()
service_types = set()

with path.open(encoding="utf8") as f:
    reader = csv.DictReader(f)
    
    for row in reader:
        priorities.add(row.get("PRIORITY", "").strip())
        departments.add(row.get("DEPT_NAME", "").strip())
        neighborhoods.add(row.get("NEIGHBORHOOD", "").strip())
        service_types.add(row.get("SR_TYPE", "").strip())

print("=== UNIQUE PRIORITIES ===")
print(f"Length: {len(list(filter(None, priorities)))}")
print(sorted(list(filter(None, priorities))))

print("\n=== UNIQUE DEPARTMENTS ===")
print(f"Length: {len(list(filter(None, departments)))}")
print(sorted(list(filter(None, departments))))

print("\n=== UNIQUE NEIGHBORHOODS ===")
print(f"Length: {len(list(filter(None, neighborhoods)))}")
print(sorted(list(filter(None, neighborhoods))))

print("\n=== UNIQUE SERVICE TYPES ===")
print(f"Length: {len(list(filter(None, service_types)))}")
print(sorted(list(filter(None, service_types))))
