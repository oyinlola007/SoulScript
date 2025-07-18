import uuid
import pytest
from fastapi.testclient import TestClient
from app.core.config import settings


def generate_anon_id():
    return uuid.uuid4().hex


@pytest.fixture
def anon_id():
    return generate_anon_id()


@pytest.fixture
def anon_session(client: TestClient, anon_id):
    r = client.post(
        f"{settings.API_V1_STR}/chat/anon/session", json={"anon_session_id": anon_id}
    )
    assert r.status_code == 200
    return r.json()


def test_create_anon_chat_session(client: TestClient, anon_id):
    r = client.post(
        f"{settings.API_V1_STR}/chat/anon/session", json={"anon_session_id": anon_id}
    )
    assert r.status_code == 200
    session = r.json()
    assert session["anon_session_id"] == anon_id
    assert session["owner_id"] is None
    assert session["title"] == "New Chat"
    # Duplicate create returns same session
    r2 = client.post(
        f"{settings.API_V1_STR}/chat/anon/session", json={"anon_session_id": anon_id}
    )
    assert r2.status_code == 200
    assert r2.json()["id"] == session["id"]
    assert r2.json()["owner_id"] is None
    assert r2.json()["title"] == "New Chat"


def test_get_anon_chat_session(client: TestClient, anon_session, anon_id):
    r = client.get(
        f"{settings.API_V1_STR}/chat/anon/session", params={"anon_session_id": anon_id}
    )
    assert r.status_code == 200
    assert r.json()["anon_session_id"] == anon_id


def test_send_and_get_anon_chat_message(client: TestClient, anon_session, anon_id):
    content = "Hello AI!"
    r = client.post(
        f"{settings.API_V1_STR}/chat/anon/session/message",
        json={"anon_session_id": anon_id, "content": content},
    )
    assert r.status_code == 200
    msg = r.json()
    assert msg["content"] == content
    # Fetch messages
    r2 = client.get(
        f"{settings.API_V1_STR}/chat/anon/session/messages",
        params={"anon_session_id": anon_id},
    )
    assert r2.status_code == 200
    assert any(m["content"] == content for m in r2.json()["data"])


def test_anon_chat_session_not_found(client: TestClient):
    bad_anon_id = generate_anon_id()
    r = client.get(
        f"{settings.API_V1_STR}/chat/anon/session",
        params={"anon_session_id": bad_anon_id},
    )
    assert r.status_code == 404
    r2 = client.get(
        f"{settings.API_V1_STR}/chat/anon/session/messages",
        params={"anon_session_id": bad_anon_id},
    )
    assert r2.status_code == 404
    r3 = client.post(
        f"{settings.API_V1_STR}/chat/anon/session/message",
        json={"anon_session_id": bad_anon_id, "content": "hi"},
    )
    assert r3.status_code == 404
