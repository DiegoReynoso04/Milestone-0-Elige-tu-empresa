"""Endpoints `/profiles` (AUTH-01). El perfil es siempre el del usuario del token.

No se acepta ningún `user_id` del cliente: `ProfileUpdate` lo rechaza con 422
y el dueño lo determina `get_current_user`.
"""

from fastapi import APIRouter

from app.auth.dependencies import CurrentUserDep, UserServiceDep
from app.auth.models import Profile, ProfileUpdate

router = APIRouter(tags=["profiles"])


@router.get("/me", response_model=Profile)
def read_my_profile(current_user: CurrentUserDep, service: UserServiceDep) -> Profile:
    return service.get_profile(str(current_user.id))


@router.put("/me", response_model=Profile)
def update_my_profile(payload: ProfileUpdate, current_user: CurrentUserDep, service: UserServiceDep) -> Profile:
    """Actualiza `name`, `phone` y `address` (solo los campos enviados)."""
    return service.update_profile(str(current_user.id), payload)
