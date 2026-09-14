from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.security import hash_password, verify_password
from app.auth import create_access_token
from app.config import engine, Base, get_db

from app.models.user import User
from app.models.video import Video

from app.schemas.user import UserCreate, UserLogin

from app.routers.upload import router as upload_router
from app.routers.video import router as video_router
from app.routers.youtube import router as youtube_router
from app.routers.chatbot import router as chatbot_router

app = FastAPI()
app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)


# ---------------- CORS ----------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- DATABASE ----------------

Base.metadata.create_all(bind=engine)


# ---------------- ROUTERS ----------------

app.include_router(upload_router)
app.include_router(video_router)
app.include_router(youtube_router)
app.include_router(chatbot_router)

# ---------------- HOME ----------------

@app.get("/")
def home():
    return {
        "message": "ClipMind AI Backend is Running!"
    }


# ---------------- REGISTER ----------------

@app.post("/register")
def register(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    hashed_password = hash_password(user.password)

    new_user = User(
        username=user.username,
        email=user.email,
        password=hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User Registered Successfully",
        "username": new_user.username,
        "email": new_user.email
    }


# ---------------- LOGIN ----------------

@app.post("/login")
def login(
    user: UserLogin,
    db: Session = Depends(get_db)
):

    db_user = (
        db.query(User)
        .filter(User.username == user.username)
        .first()
    )

    if not db_user:
        return {
            "message": "User not found"
        }

    if not verify_password(
        user.password,
        db_user.password
    ):
        return {
            "message": "Invalid password"
        }

    token = create_access_token({
        "sub": db_user.username
    })

    return {
        "message": "Login Successful",
        "access_token": token,
        "username": db_user.username
    }


print("Database tables created!")