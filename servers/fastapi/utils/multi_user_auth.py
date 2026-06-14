"""
multi_user_auth.py — Gestión de múltiples usuarios para PresentIA (ES)

Extiende el sistema de administrador único existente para soportar múltiples usuarios
con roles (admin / user). El admin es siempre el usuario configurado en userConfig.json.
Los usuarios adicionales se almacenan en una base de datos SQLite separada.
"""

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from typing import Optional

from utils.get_env import get_user_config_path_env
from utils.simple_auth import (
    SESSION_TTL_SECONDS,
    _base64url_decode,
    _base64url_encode,
    _load_user_config,
    _sign_payload,
    _verify_password_hash,
    _encode_password_hash,
    _get_or_create_auth_secret,
    set_session_cookie,
    clear_session_cookie,
    get_session_token_from_request,
    SESSION_COOKIE_NAME,
)

ROLE_ADMIN = "admin"
ROLE_USER = "user"
MULTI_USER_DB_FILENAME = "presentia_users.db"
SESSION_VERSION_MULTI = 2  # Distingue del formato v1 del admin único


def _get_db_path() -> str:
    """Obtiene la ruta de la base de datos de usuarios extra (junto a userConfig.json)."""
    user_config_path = get_user_config_path_env()
    if user_config_path:
        base_dir = os.path.dirname(user_config_path)
    else:
        # Fallback: directorio de trabajo actual
        base_dir = os.getcwd()
    return os.path.join(base_dir, MULTI_USER_DB_FILENAME)


@contextmanager
def _get_db():
    """Context manager para conexiones SQLite."""
    db_path = _get_db_path()
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_multi_user_db() -> None:
    """Crea la tabla de usuarios si no existe."""
    with _get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at INTEGER NOT NULL,
                display_name TEXT
            )
        """)
        conn.commit()


def list_extra_users() -> list[dict]:
    """
    Devuelve todos los usuarios extra (no admin) almacenados en SQLite.
    El admin principal se gestiona por userConfig.json y no aparece aquí.
    """
    init_multi_user_db()
    with _get_db() as conn:
        rows = conn.execute(
            "SELECT username, role, created_at, display_name FROM users ORDER BY created_at ASC"
        ).fetchall()
    return [dict(row) for row in rows]


def create_extra_user(username: str, password: str, role: str = ROLE_USER, display_name: Optional[str] = None) -> dict:
    """
    Crea un usuario adicional (no el admin principal).
    Raises ValueError si el usuario ya existe o los datos son inválidos.
    """
    cleaned = (username or "").strip()
    if len(cleaned) < 3:
        raise ValueError("El nombre de usuario debe tener al menos 3 caracteres")
    if len(password or "") < 6:
        raise ValueError("La contraseña debe tener al menos 6 caracteres")
    if role not in (ROLE_ADMIN, ROLE_USER):
        raise ValueError(f"Rol inválido: {role}")

    init_multi_user_db()

    # Verificar que no coincida con el admin principal
    config = _load_user_config()
    admin_username = (config.get("AUTH_USERNAME") or "").strip()
    if admin_username and hmac.compare_digest(cleaned.lower(), admin_username.lower()):
        raise ValueError("Ya existe un usuario con ese nombre de usuario")

    password_hash = _encode_password_hash(password)
    now = int(time.time())

    try:
        with _get_db() as conn:
            conn.execute(
                "INSERT INTO users (username, password_hash, role, created_at, display_name) VALUES (?, ?, ?, ?, ?)",
                (cleaned, password_hash, role, now, display_name or cleaned),
            )
            conn.commit()
    except sqlite3.IntegrityError:
        raise ValueError("Ya existe un usuario con ese nombre de usuario")

    return {"username": cleaned, "role": role, "created_at": now, "display_name": display_name or cleaned}


def delete_extra_user(username: str) -> bool:
    """
    Elimina un usuario adicional.
    Retorna True si se eliminó, False si no existía.
    """
    init_multi_user_db()
    with _get_db() as conn:
        cursor = conn.execute("DELETE FROM users WHERE username = ?", (username.strip(),))
        conn.commit()
        return cursor.rowcount > 0


def verify_extra_user_credentials(username: str, password: str) -> Optional[dict]:
    """
    Verifica credenciales de usuario adicional.
    Retorna dict con info del usuario si las credenciales son correctas, None si no.
    """
    init_multi_user_db()
    cleaned = (username or "").strip()
    with _get_db() as conn:
        row = conn.execute(
            "SELECT username, password_hash, role, display_name FROM users WHERE username = ?",
            (cleaned,),
        ).fetchone()

    if not row:
        return None

    if not _verify_password_hash(password or "", row["password_hash"]):
        return None

    return {"username": row["username"], "role": row["role"], "display_name": row["display_name"]}


def create_multi_user_session_token(username: str, role: str) -> str:
    """
    Crea un token de sesión v2 que incluye el rol del usuario.
    Compatible con el sistema de firma existente.
    """
    config = _load_user_config()
    secret = _get_or_create_auth_secret(config)

    issued_at = int(time.time())
    payload = {
        "v": SESSION_VERSION_MULTI,
        "u": username,
        "role": role,
        "iat": issued_at,
        "exp": issued_at + SESSION_TTL_SECONDS,
    }

    payload_encoded = _base64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signature_encoded = _sign_payload(payload_encoded, secret)
    return f"{payload_encoded}.{signature_encoded}"


def validate_multi_user_session_token(token: Optional[str]) -> Optional[dict]:
    """
    Valida un token v2 multi-usuario.
    Retorna dict con username y role si válido, None si no.
    """
    if not token:
        return None

    try:
        payload_encoded, signature_encoded = token.split(".", 1)
    except ValueError:
        return None

    config = _load_user_config()
    secret = config.get("AUTH_SECRET_KEY")
    if not secret:
        return None

    expected_signature = _sign_payload(payload_encoded, secret)
    if not hmac.compare_digest(signature_encoded, expected_signature):
        return None

    try:
        payload_raw = _base64url_decode(payload_encoded)
        payload = json.loads(payload_raw)
    except Exception:
        return None

    if payload.get("v") != SESSION_VERSION_MULTI:
        return None

    username = payload.get("u")
    role = payload.get("role")
    expires_at = payload.get("exp")

    if not isinstance(username, str) or not isinstance(expires_at, int):
        return None

    if expires_at < int(time.time()):
        return None

    return {"username": username, "role": role or ROLE_USER}


def get_current_user_from_request(request) -> Optional[dict]:
    """
    Obtiene el usuario actual desde la request.
    Primero intenta token v2 (multi-usuario), luego v1 (admin único).
    Retorna dict con username y role, o None.
    """
    from fastapi import Request
    from utils.simple_auth import validate_session_token

    token = get_session_token_from_request(request)
    if not token:
        return None

    # Intentar v2 primero
    multi_user = validate_multi_user_session_token(token)
    if multi_user:
        return multi_user

    # Fallback a v1 (admin único)
    admin_username = validate_session_token(token)
    if admin_username:
        return {"username": admin_username, "role": ROLE_ADMIN}

    return None


def is_admin(user: Optional[dict]) -> bool:
    return user is not None and user.get("role") == ROLE_ADMIN


def get_all_users() -> list[dict]:
    """
    Devuelve todos los usuarios: el admin principal + los usuarios extra en SQLite.
    """
    config = _load_user_config()
    admin_username = (config.get("AUTH_USERNAME") or "").strip()

    users = []
    if admin_username:
        users.append({
            "username": admin_username,
            "role": ROLE_ADMIN,
            "display_name": admin_username,
            "is_admin": True,
        })

    for extra_user in list_extra_users():
        users.append({
            "username": extra_user["username"],
            "role": extra_user["role"],
            "display_name": extra_user.get("display_name") or extra_user["username"],
            "is_admin": extra_user["role"] == ROLE_ADMIN,
        })

    return users
