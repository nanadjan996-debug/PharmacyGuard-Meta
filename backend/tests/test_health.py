from app.core.security import hash_password, verify_password, create_access_token, decode_access_token


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["project"] == "PharmacyGuard"
    assert data["status"] == "online"
    assert "deterministic" in data["engine"]


def test_health_check_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["project"] == "PharmacyGuard"
    assert data["engine_type"] == "deterministic_rule_based"
    assert "advisory" in data["disclaimer"].lower() or "synthetic" in data["disclaimer"].lower()


def test_password_hashing_and_verification():
    raw_password = "demo_pharmacist_password_123"
    hashed = hash_password(raw_password)
    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True
    assert verify_password("wrong_password", hashed) is False


def test_jwt_token_creation_and_decoding():
    user_id = "test-user-001"
    role = "staff_pharmacist"
    token = create_access_token(subject=user_id, role=role)
    assert isinstance(token, str)
    
    payload = decode_access_token(token)
    assert payload["sub"] == user_id
    assert payload["role"] == role
    assert "exp" in payload
