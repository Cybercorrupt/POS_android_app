"""Backend tests for SELLIX cloud backup endpoints."""
import os
import uuid
import pytest
import requests

def _resolve_base_url() -> str:
    url = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not url:
        # fallback: read from frontend/.env
        env_path = "/app/frontend/.env"
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                        url = line.strip().split("=", 1)[1].strip().strip('"').strip("'")
                        break
    if not url:
        raise RuntimeError("EXPO_PUBLIC_BACKEND_URL is not configured")
    return url.rstrip("/")


BASE_URL = _resolve_base_url()
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _sample_payload(code=None, store="TEST_Toko"):
    body = {
        "store_name": store,
        "data": {
            "app": "kasir-pos",
            "version": 1,
            "exportedAt": "2026-01-01T00:00:00Z",
            "tables": {
                "products": [{"id": "p1", "name": "Kopi"}, {"id": "p2", "name": "Teh"}],
                "sales": [{"id": "s1", "total": 10000}],
                "customers": [{"id": "c1"}, {"id": "c2"}, {"id": "c3"}],
            },
        },
    }
    if code is not None:
        body["code"] = code
    return body


class TestCloudBackup:
    created_code = None

    def test_health_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("message") == "Hello World"

    def test_push_creates_new_code(self, session):
        r = session.post(f"{API}/cloud/backup", json=_sample_payload())
        assert r.status_code == 200, r.text
        d = r.json()
        assert "code" in d and isinstance(d["code"], str) and len(d["code"]) >= 6
        assert "updated_at" in d
        assert d["summary"] == {"products": 2, "sales": 1, "customers": 3}
        TestCloudBackup.created_code = d["code"]

    def test_pull_returns_same_data(self, session):
        code = TestCloudBackup.created_code
        assert code, "needs create test first"
        r = session.get(f"{API}/cloud/backup/{code}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["code"] == code
        assert d["store_name"] == "TEST_Toko"
        assert d["data"]["app"] == "kasir-pos"
        assert d["data"]["tables"]["products"][0]["name"] == "Kopi"
        assert d["summary"]["products"] == 2

    def test_push_with_existing_code_upserts(self, session):
        code = TestCloudBackup.created_code
        payload = _sample_payload(code=code, store="TEST_Toko_Updated")
        # change data
        payload["data"]["tables"]["sales"] = [{"id": "s1"}, {"id": "s2"}, {"id": "s3"}]
        r = session.post(f"{API}/cloud/backup", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["code"] == code
        assert d["summary"]["sales"] == 3

        # verify via GET: no duplicate, store_name updated
        g = session.get(f"{API}/cloud/backup/{code}")
        assert g.status_code == 200
        gd = g.json()
        assert gd["store_name"] == "TEST_Toko_Updated"
        assert gd["summary"]["sales"] == 3

    def test_pull_unknown_code_returns_404(self, session):
        bogus = "NO" + uuid.uuid4().hex[:8].upper()
        r = session.get(f"{API}/cloud/backup/{bogus}")
        assert r.status_code == 404

    def test_push_code_is_case_insensitive(self, session):
        # push with lower-case code -> server upper-cases
        code = "testcode" + uuid.uuid4().hex[:4]
        payload = _sample_payload(code=code)
        r = session.post(f"{API}/cloud/backup", json=payload)
        assert r.status_code == 200
        returned = r.json()["code"]
        assert returned == code.upper()
        g = session.get(f"{API}/cloud/backup/{returned.lower()}")
        assert g.status_code == 200
