import uuid
import pytest
from fastapi.testclient import TestClient
from app.core.config import settings
from app.tests.utils.utils import random_lower_string


def create_chat_session(client, token_headers, title="User Chat"):
    r = client.post(
        f"{settings.API_V1_STR}/chat/sessions",
        headers=token_headers,
        json={"title": title},
    )
    assert r.status_code == 200
    return r.json()


@pytest.fixture
def user_chat_session(client, superuser_token_headers):
    return create_chat_session(client, superuser_token_headers)


def test_create_user_chat_session(client: TestClient, superuser_token_headers):
    session = create_chat_session(client, superuser_token_headers)
    assert session["title"] == "User Chat"
    assert session["owner_id"]


def test_get_user_chat_sessions(
    client: TestClient, superuser_token_headers, user_chat_session
):
    r = client.get(
        f"{settings.API_V1_STR}/chat/sessions", headers=superuser_token_headers
    )
    assert r.status_code == 200
    data = r.json()
    assert any(s["id"] == user_chat_session["id"] for s in data["data"])


def test_send_and_get_user_chat_message(
    client: TestClient, superuser_token_headers, user_chat_session
):
    content = "Hello Authenticated AI!"
    session_id = user_chat_session["id"]
    r = client.post(
        f"{settings.API_V1_STR}/chat/sessions/{session_id}/messages",
        headers=superuser_token_headers,
        json={"content": content, "role": "user"},
    )
    assert r.status_code == 200 or r.status_code == 201
    # Fetch messages
    r2 = client.get(
        f"{settings.API_V1_STR}/chat/sessions/{session_id}/messages",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    assert any(m["content"] == content for m in r2.json()["data"])


def test_user_chat_session_not_found(client: TestClient, superuser_token_headers):
    bad_session_id = str(uuid.uuid4())
    r = client.get(
        f"{settings.API_V1_STR}/chat/sessions/{bad_session_id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
    r2 = client.get(
        f"{settings.API_V1_STR}/chat/sessions/{bad_session_id}/messages",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 404
    r3 = client.post(
        f"{settings.API_V1_STR}/chat/sessions/{bad_session_id}/messages",
        headers=superuser_token_headers,
        json={"content": "hi", "role": "user"},
    )
    assert r3.status_code == 404
