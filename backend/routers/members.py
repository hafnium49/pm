from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import get_db
from backend.deps import effective_role, get_owned_board, get_readable_board
from backend.models import Board, BoardMembership, User

router = APIRouter(prefix="/api/boards")

CollaboratorRole = Literal["editor", "viewer"]


class InviteMemberBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    role: CollaboratorRole = "editor"


class UpdateMemberRoleBody(BaseModel):
    role: CollaboratorRole


def _serialize_member(user: User, role: str, is_owner: bool) -> dict:
    return {
        "user_id": str(user.id),
        "username": user.username,
        "role": role,
        "is_owner": is_owner,
    }


@router.get("/{board_id}/members")
def list_members(
    board_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_readable_board(board_id, user, db)
    out: list[dict] = []
    out.append(_serialize_member(board.user, "owner", True))
    for m in board.memberships:
        out.append(_serialize_member(m.user, m.role, False))
    return {"members": out}


@router.post("/{board_id}/members")
def invite_member(
    board_id: int,
    body: InviteMemberBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_owned_board(board_id, user, db)
    target = db.query(User).filter_by(username=body.username.strip()).first()
    if not target:
        raise HTTPException(status_code=404, detail="No such user")
    if target.id == board.user_id:
        raise HTTPException(status_code=400, detail="That user already owns this board")
    existing = (
        db.query(BoardMembership)
        .filter_by(board_id=board.id, user_id=target.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="User is already a member")
    membership = BoardMembership(board_id=board.id, user_id=target.id, role=body.role)
    db.add(membership)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="User is already a member")
    return _serialize_member(target, body.role, False)


@router.post("/{board_id}/members/{user_id}")
def update_member_role(
    board_id: int,
    user_id: int,
    body: UpdateMemberRoleBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_owned_board(board_id, user, db)
    if user_id == board.user_id:
        raise HTTPException(status_code=400, detail="Cannot change the owner's role")
    membership = (
        db.query(BoardMembership)
        .filter_by(board_id=board.id, user_id=user_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")
    membership.role = body.role
    db.commit()
    target = db.query(User).filter_by(id=user_id).first()
    return _serialize_member(target, body.role, False) if target else {"role": body.role}


@router.delete("/{board_id}/members/{user_id}")
def remove_member(
    board_id: int,
    user_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = db.query(Board).filter_by(id=board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    role = effective_role(board, user, db)
    if role is None:
        raise HTTPException(status_code=404, detail="Board not found")
    # Owner cannot be removed; they must delete the board instead
    if user_id == board.user_id:
        raise HTTPException(
            status_code=400,
            detail="The owner cannot be removed. Delete the board instead.",
        )
    # Permission: owner can remove anyone; non-owners can only remove themselves
    if user_id != user.id and role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can remove other members")
    membership = (
        db.query(BoardMembership)
        .filter_by(board_id=board.id, user_id=user_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(membership)
    db.commit()
    return {"ok": True}
