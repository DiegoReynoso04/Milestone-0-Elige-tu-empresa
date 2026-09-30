"""Capa de servicios de usuarios y perfiles (AUTH-01).

Funciones pedidas por el ticket: crear usuario, obtener por ID, obtener por
email, actualizar y eliminar; más autenticación y perfil. Hashea contraseñas
antes de llegar al repositorio y traduce los resultados a errores de la API.
Las reglas de permiso (propio usuario o admin) viven en `dependencies.py`.
"""

from typing import Any

from app.auth.models import Profile, ProfileFields, ProfileUpdate, UserCreate, UserInDB, UserRole, UserUpdate
from app.auth.repository import AuthRepository, DuplicateEmailError
from app.auth.security import burn_password_check, hash_password, verify_password
from app.core.errors import EmailAlreadyRegisteredError, ProfileNotFoundError, UserNotFoundError


class UserService:
    def __init__(self, repository: AuthRepository) -> None:
        self.repository = repository

    def create_user(self, payload: UserCreate, role: UserRole = UserRole.USER) -> tuple[UserInDB, Profile]:
        """Crea el usuario (contraseña hasheada) y su `Profile` en la misma operación.

        `role` lo decide el backend: `POST /users` usa siempre `user`; solo
        `create-admin` pasa `admin`.
        """
        profile = ProfileFields.model_validate(payload.model_dump(include={"name", "phone", "address"}))
        try:
            return self.repository.create_user(
                email=payload.email,
                hashed_password=hash_password(payload.password),
                role=role,
                profile=profile,
            )
        except DuplicateEmailError:
            raise EmailAlreadyRegisteredError() from None

    def list_users(self) -> list[UserInDB]:
        return self.repository.list_users()

    def get_user_by_id(self, user_id: str) -> UserInDB:
        user = self.repository.get_user(user_id)
        if user is None:
            raise UserNotFoundError()
        return user

    def get_user_by_email(self, email: str) -> UserInDB | None:
        return self.repository.get_user_by_email(email)

    def update_user(self, user_id: str, payload: UserUpdate) -> UserInDB:
        """Aplica los campos enviados. Quién puede cambiar `role` lo decide la ruta."""
        fields: dict[str, Any] = {}
        if payload.email is not None:
            fields["email"] = payload.email
        if payload.password is not None:
            fields["hashed_password"] = hash_password(payload.password)
        if payload.role is not None:
            fields["role"] = payload.role.value
        if not fields:
            return self.get_user_by_id(user_id)
        try:
            user = self.repository.update_user(user_id, fields)
        except DuplicateEmailError:
            raise EmailAlreadyRegisteredError() from None
        if user is None:
            raise UserNotFoundError()
        return user

    def delete_user(self, user_id: str) -> None:
        """Elimina el usuario y su `Profile` vinculado."""
        if not self.repository.delete_user(user_id):
            raise UserNotFoundError()

    def authenticate(self, email: str, password: str) -> UserInDB | None:
        """Usuario activo cuyas credenciales coinciden, o `None`. Compara solo contra el hash."""
        user = self.repository.get_user_by_email(email)
        if user is None:
            burn_password_check(password)
            return None
        if not verify_password(password, user.hashed_password) or not user.is_active:
            return None
        return user

    def get_profile(self, user_id: str) -> Profile:
        profile = self.repository.get_profile(user_id)
        if profile is None:
            raise ProfileNotFoundError()
        return profile

    def update_profile(self, user_id: str, payload: ProfileUpdate) -> Profile:
        """Actualiza solo los campos enviados (`null` borra el dato)."""
        fields = payload.model_dump(exclude_unset=True)
        if not fields:
            return self.get_profile(user_id)
        profile = self.repository.update_profile(user_id, fields)
        if profile is None:
            raise ProfileNotFoundError()
        return profile
