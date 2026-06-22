from fastapi.testclient import TestClient

from app.main import app


def test_health_primary_judge_is_not_llm():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["primary_judge"] == "dog_pose_estimation"
    assert response.json()["llm_primary_judge"] is False
