"""
Router de gestión de usuarios (multi-usuario).
Permite al administrador listar, crear y eliminar usuarios.
Endpoints bajo /api/v1/auth/users
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse
from typing import Optional

from utils.multi_user_auth import (
    ROLE_ADMIN,
    ROLE_USER,
    create_extra_user,
    delete_extra_user,
    get_all_users,
    get_current_user_from_request,
    is_admin,
    create_multi_user_session_token,
    verify_extra_user_credentials,
)
from utils.simple_auth import (
    get_auth_status,
    get_session_token_from_request,
    is_auth_configured,
    verify_credentials,
    create_session_token,
    set_session_cookie,
    clear_session_cookie,
)
from utils.get_env import is_disable_auth_enabled

API_V1_USERS_ROUTER = APIRouter(prefix="/api/v1/auth/users", tags=["Usuarios"])


def _require_admin(request: Request) -> dict:
    """Dependencia que exige que el usuario sea administrador."""
    if is_disable_auth_enabled():
        return {"username": "electron", "role": ROLE_ADMIN}

    user = get_current_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Se requieren permisos de administrador")
    return user


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=3, max_length=128)
    password: str = Field(min_length=6, max_length=256)
    role: str = Field(default="user", pattern="^(admin|user)$")
    display_name: Optional[str] = Field(default=None, max_length=128)


@API_V1_USERS_ROUTER.get("/")
async def list_users(request: Request):
    """Lista todos los usuarios (solo admin)."""
    _require_admin(request)
    users = get_all_users()
    return {"users": users, "total": len(users)}


@API_V1_USERS_ROUTER.post("/")
async def create_user(body: CreateUserRequest, request: Request):
    """Crea un nuevo usuario (solo admin)."""
    _require_admin(request)

    try:
        user = create_extra_user(
            username=body.username,
            password=body.password,
            role=body.role,
            display_name=body.display_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return JSONResponse({"success": True, "user": user}, status_code=201)


@API_V1_USERS_ROUTER.delete("/{username}")
async def delete_user(username: str, request: Request):
    """Elimina un usuario adicional (solo admin)."""
    current_user = _require_admin(request)

    # No puede eliminarse a sí mismo
    if current_user.get("username", "").strip().lower() == username.strip().lower():
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")

    deleted = delete_extra_user(username)
    if not deleted:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return JSONResponse({"success": True, "message": f"Usuario '{username}' eliminado"})


@API_V1_USERS_ROUTER.get("/me")
async def get_current_user(request: Request):
    """Devuelve información del usuario actualmente autenticado."""
    if is_disable_auth_enabled():
        return {"username": "electron", "role": ROLE_ADMIN, "authenticated": True}

    user = get_current_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")

    return {
        "username": user.get("username"),
        "role": user.get("role", ROLE_USER),
        "authenticated": True,
    }
