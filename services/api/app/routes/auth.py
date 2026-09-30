"""Endpoints `/auth` (AUTH-01): login con OAuth2 password flow y usuario actual."""

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.auth.dependencies import CurrentUserDep, SettingsDep, UserServiceDep
from app.auth.models import CurrentUser, Token, normalize_email
from app.auth.security import TOKEN_TYPE, burn_password_check, create_access_token, expires_in_seconds
from app.core.errors import InvalidCredentialsError

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=Token)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()], settings: SettingsDep, service: UserServiceDep
) -> Token:
    """Valida email + contraseña y devuelve un JWT de acceso.

    Formulario OAuth2 (`application/x-www-form-urlencoded`): el campo
    `username` es el **email**. Es lo que envía el botón "Authorize" de /docs.
    """
    try:
        email = normalize_email(form.username)
    except ValueError:
        burn_password_check(form.password)
        raise InvalidCredentialsError() from None
    user = service.authenticate(email, form.password)
    if user is None:
        raise InvalidCredentialsError()
    return Token(
        access_token=create_access_token(settings, str(user.id)),
        token_type=TOKEN_TYPE,
        expires_in=expires_in_seconds(settings),
    )


@router.get("/me", response_model=CurrentUser)
def read_current_user(current_user: CurrentUserDep, service: UserServiceDep) -> CurrentUser:
    """`email`, `role` y el `Profile` vinculado del usuario autenticado. Nunca credenciales."""
    profile = service.repository.get_profile(str(current_user.id))
    return CurrentUser(**current_user.public().model_dump(), profile=profile)
