"""
Pydantic schemas for auth endpoints.
"""
from pydantic import BaseModel, EmailStr, field_validator


class SignupRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = "Titan Employee"
    department: str | None = "General"
    role: str | None = "Employee"
    title: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    status: str | None = "online"
    status_message: str | None = None
    access_token: str | None = None
    token_type: str = "bearer"

    model_config = {"from_attributes": True}


class AuthError(BaseModel):
    code: str
    message: str
    trace_id: str = ""
