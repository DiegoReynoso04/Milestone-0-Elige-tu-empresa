"""Acceso a TinyDB para `User` y `Profile` (AUTH-01). Única capa que toca esa base.

Un archivo propio (`Settings.auth_db_path`, por defecto
`services/api/data/auth.json`, ignorado por git), separado del de proveedores,
con dos tablas: `users` y `profiles`. User y Profile viven solo aquí: no hay
tablas de usuarios ni perfiles en ninguna otra base.

Identidad: `User.id` y `Profile.id` son UUID v4 generados por el sistema y
guardados como campo del documento. No se usa el `doc_id` interno de TinyDB
(entero y dependiente del archivo) para que el `id` sea estable, viaje en el
JWT (`sub`) y otros módulos puedan referenciarlo como `user_uuid`.
`Profile.user_id` = `User.id`.

Mismo patrón que `SupplierRepository`: `threading.Lock` + la base se abre y se
cierra en cada operación; exige un único worker. Crear un usuario inserta su
perfil en la misma operación y borrarlo borra también su perfil.
"""

import threading
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from tinydb import Query, TinyDB
from tinydb.table import Document, Table

from app.auth.models import Profile, ProfileFields, UserInDB, UserRole

USERS_TABLE = "users"
PROFILES_TABLE = "profiles"


class DuplicateEmailError(Exception):
    """Ya existe un usuario con ese email (se traduce a 409 en el servicio)."""


def utc_now() -> datetime:
    return datetime.now(UTC)


class AuthRepository:
    def __init__(self, path: Path, clock: Callable[[], datetime] = utc_now) -> None:
        self.path = path
        self._clock = clock
        self._lock = threading.Lock()

    @contextmanager
    def _tables(self) -> Iterator[tuple[Table, Table]]:
        with self._lock, TinyDB(self.path, create_dirs=True, encoding="utf-8", indent=2) as db:
            yield db.table(USERS_TABLE), db.table(PROFILES_TABLE)

    def create_user(
        self, email: str, hashed_password: str, role: UserRole, profile: ProfileFields
    ) -> tuple[UserInDB, Profile]:
        """Inserta el usuario y su perfil. `hashed_password` ya viene hasheado."""
        user_record: dict[str, Any] = {
            "id": str(uuid4()),
            "email": email,
            "hashed_password": hashed_password,
            "is_active": True,
            "role": role.value,
            "created_at": self._clock().isoformat(),
        }
        profile_record: dict[str, Any] = {
            "id": str(uuid4()),
            "user_id": user_record["id"],
            **profile.model_dump(include={"name", "phone", "address"}),
        }
        with self._tables() as (users, profiles):
            if users.contains(Query().email == email):
                raise DuplicateEmailError
            users.insert(user_record)
            profiles.insert(profile_record)
        return UserInDB.model_validate(user_record), Profile.model_validate(profile_record)

    def list_users(self) -> list[UserInDB]:
        with self._tables() as (users, _):
            documents = users.all()
        return [UserInDB.model_validate(document) for document in documents]

    def get_user(self, user_id: str) -> UserInDB | None:
        with self._tables() as (users, _):
            document = users.get(Query().id == user_id)
        return UserInDB.model_validate(document) if isinstance(document, Document) else None

    def get_user_by_email(self, email: str) -> UserInDB | None:
        with self._tables() as (users, _):
            document = users.get(Query().email == email)
        return UserInDB.model_validate(document) if isinstance(document, Document) else None

    def update_user(self, user_id: str, fields: dict[str, Any]) -> UserInDB | None:
        """Actualiza campos de credenciales. Comprueba el email único en la misma operación."""
        with self._tables() as (users, _):
            if not users.contains(Query().id == user_id):
                return None
            email = fields.get("email")
            if email is not None and users.contains((Query().email == email) & (Query().id != user_id)):
                raise DuplicateEmailError
            users.update(fields, Query().id == user_id)
            document = users.get(Query().id == user_id)
        assert isinstance(document, Document)
        return UserInDB.model_validate(document)

    def delete_user(self, user_id: str) -> bool:
        """Borra el usuario y su perfil vinculado (nunca queda un perfil huérfano)."""
        with self._tables() as (users, profiles):
            if not users.contains(Query().id == user_id):
                return False
            profiles.remove(Query().user_id == user_id)
            users.remove(Query().id == user_id)
        return True

    def get_profile(self, user_id: str) -> Profile | None:
        with self._tables() as (_, profiles):
            document = profiles.get(Query().user_id == user_id)
        return Profile.model_validate(document) if isinstance(document, Document) else None

    def update_profile(self, user_id: str, fields: dict[str, Any]) -> Profile | None:
        with self._tables() as (_, profiles):
            if not profiles.contains(Query().user_id == user_id):
                return None
            profiles.update(fields, Query().user_id == user_id)
            document = profiles.get(Query().user_id == user_id)
        assert isinstance(document, Document)
        return Profile.model_validate(document)
