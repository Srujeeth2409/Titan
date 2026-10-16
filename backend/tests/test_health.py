from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_search_endpoint_returns_trace_id():
    import uuid

    response = client.post(
        "/api/v1/search",
        json={"query": "what is hybrid retrieval?", "workspace_id": str(uuid.uuid4())},
    )
    assert response.status_code == 200
    body = response.json()
    assert "trace_id" in body
    assert body["query"] == "what is hybrid retrieval?"
