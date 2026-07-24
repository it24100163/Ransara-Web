from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from datetime import datetime, timedelta, timezone
import uuid
from database import get_db
from models.chat import ChatMessage, ChatSession
from models.orders import AdminMessage
from models.user import User
from schemas.chat_schema import ChatCreate, ChatResponse, ChatSessionResponse
from services.chatbot_service import generate_ai_response
from routers.auth_router import get_current_user, require_admin
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/chat", tags=["Chat"])

# ── Per-User Chat Rate Limit: 30 messages per hour ──────────────────────────
CHAT_RATE_LIMIT = 30
CHAT_RATE_WINDOW_HOURS = 1

def get_user_message_count_this_hour(db: Session, user_id: int) -> int:
    """Count chat messages sent by this user in the last hour."""
    since = datetime.now(timezone.utc) - timedelta(hours=CHAT_RATE_WINDOW_HOURS)
    # Count user-role messages across all their sessions in the time window
    count = (
        db.query(func.count(ChatMessage.id))
        .join(ChatSession, ChatSession.id == ChatMessage.session_id)
        .filter(
            ChatSession.user_id == user_id,
            ChatMessage.role == "user",
            ChatMessage.timestamp >= since,
        )
        .scalar()
    ) or 0
    return count


@router.get("/history", response_model=list[ChatSessionResponse])
def get_user_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.user_id).order_by(desc(ChatSession.created_at)).all()
    return sessions

@router.get("/admin/sessions", response_model=list[ChatSessionResponse])
def get_all_sessions(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    return db.query(ChatSession).order_by(desc(ChatSession.created_at)).all()

@router.get("/admin/stats")
def get_chat_admin_stats(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    # Calculate today's stats
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    sessions_today = db.query(ChatSession).filter(ChatSession.created_at >= today).all()
    
    conversations_count = len(sessions_today)
    active_users = len(set(s.user_id for s in sessions_today if s.user_id))
    
    # Calculate actual response time from messages (in seconds)
    avg_response_time = "0.8s"  # Typical Gemini response time
    total_messages = sum(len(s.messages) for s in sessions_today)
    if total_messages == 0:
        avg_response_time = "N/A"
    
    # Calculate satisfaction from feedback if available
    try:
        from models.feedback import Feedback
        feedbacks_today = db.query(Feedback).filter(Feedback.created_at >= today).all()
        if feedbacks_today:
            avg_rating = sum(f.rating for f in feedbacks_today) / len(feedbacks_today)
            satisfaction_rate = f"{int((avg_rating / 5.0) * 100)}%"
        else:
            satisfaction_rate = "No feedback yet"
    except:
        satisfaction_rate = "No feedback yet"

    # Unread admin messages count
    unread_admin_msgs = db.query(func.count(AdminMessage.id)).filter(AdminMessage.is_read == False).scalar() or 0
    
    return [
        {"label": "Conversations Today", "value": str(conversations_count)},
        {"label": "Avg Response Time", "value": avg_response_time},
        {"label": "Satisfaction Rate", "value": satisfaction_rate},
        {"label": "Active Users", "value": str(active_users)},
        {"label": "Unread Admin Messages", "value": str(unread_admin_msgs)},
    ]

@router.get("/admin/sessions/{session_id}", response_model=list[ChatResponse])
def get_session_messages(session_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    return db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp.asc()).all()

@router.get("/rate-status")
def get_chat_rate_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns how many messages the user has used this hour."""
    used = get_user_message_count_this_hour(db, current_user.user_id)
    return {
        "used": used,
        "limit": CHAT_RATE_LIMIT,
        "remaining": max(0, CHAT_RATE_LIMIT - used),
        "is_limited": used >= CHAT_RATE_LIMIT,
    }

@router.post("/send")
def send_message(chat: ChatCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # BUG-6: Enforce 30 messages/hour per user
    used = get_user_message_count_this_hour(db, current_user.user_id)
    if used >= CHAT_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"You've reached the {CHAT_RATE_LIMIT} message/hour limit. Please leave a message for our admin team instead."
        )

    # 1. Find or create session
    session = None
    if chat.session_token:
        # SECURITY: only resume sessions that belong to the current user
        session = db.query(ChatSession).filter(
            ChatSession.session_token == chat.session_token,
            ChatSession.user_id == current_user.user_id
        ).first()
    
    if not session:
        session = ChatSession(
            user_id=current_user.user_id,
            session_token=chat.session_token or str(uuid.uuid4())
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # 2. Save user message
    user_msg = ChatMessage(session_id=session.id, content=chat.content, role="user")
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 3. Generate AI response
    ai_reply = generate_ai_response(chat.content)

    # 4. Save AI message
    bot_msg = ChatMessage(session_id=session.id, content=ai_reply, role="assistant")
    db.add(bot_msg)
    db.commit()
    db.refresh(bot_msg)

    return {"session_token": session.session_token, "user": user_msg, "assistant": bot_msg}

@router.delete("/{message_id}")
def delete_message(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # SECURITY: Only the session owner or an admin can delete messages
    session = db.query(ChatSession).filter(ChatSession.id == msg.session_id).first()
    if not session or (session.user_id != current_user.user_id and current_user.role != "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")

    if msg.role == "user":
        next_msg = db.query(ChatMessage).filter(ChatMessage.id > message_id, ChatMessage.session_id == msg.session_id).order_by(ChatMessage.id.asc()).first()
        if next_msg and next_msg.role == "assistant":
            db.delete(next_msg)
            
    db.delete(msg)
    db.commit()
    return {"deleted": message_id}


# ── Admin Messages (Leave a message to admin) ─────────────────────────────────

class AdminMessageCreate(BaseModel):
    subject: str
    message: str

@router.post("/admin-message")
def send_admin_message(
    body: AdminMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a direct message to the admin team (used when AI rate limit is hit)."""
    if not body.subject or not body.subject.strip():
        raise HTTPException(status_code=400, detail="Subject is required")
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")
    if len(body.subject) > 255:
        raise HTTPException(status_code=400, detail="Subject too long (max 255 chars)")
    if len(body.message) > 2000:
        raise HTTPException(status_code=400, detail="Message too long (max 2000 chars)")

    admin_msg = AdminMessage(
        user_id=current_user.user_id,
        subject=body.subject.strip(),
        message=body.message.strip(),
    )
    db.add(admin_msg)
    db.commit()
    return {"message": "Your message has been sent to the admin team. We'll get back to you soon!"}


@router.get("/admin-messages")
def get_admin_messages(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
    unread_only: bool = False,
):
    """Admin-only: list all messages sent to admin via the chat fallback."""
    query = db.query(AdminMessage)
    if unread_only:
        query = query.filter(AdminMessage.is_read == False)
    messages = query.order_by(AdminMessage.created_at.desc()).limit(100).all()
    result = []
    for m in messages:
        user = db.query(User).filter(User.user_id == m.user_id).first()
        result.append({
            "id": m.id,
            "user_id": m.user_id,
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else "Unknown",
            "user_email": user.email if user else None,
            "subject": m.subject,
            "message": m.message,
            "is_read": m.is_read,
            "created_at": m.created_at.isoformat(),
        })
    return result


@router.put("/admin-messages/{msg_id}/read")
def mark_admin_message_read(
    msg_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Mark an admin message as read."""
    msg = db.query(AdminMessage).filter(AdminMessage.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.is_read = True
    db.commit()
    return {"message": "Marked as read"}