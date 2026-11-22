from pydantic import BaseModel

class LoginRequest(BaseModel):
    identifier: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    username: str
    first_name: str
    last_name: str
    location: str

class PasswordResetRequest(BaseModel):
    email: str

class ProfileUpdateRequest(BaseModel):
    first_name: str
    last_name: str
    location: str = ""
    password: str

class EmailUpdateRequest(BaseModel):
    new_email: str
    password: str

class PasswordUpdateRequest(BaseModel):
    new_password: str
    old_password: str

class GoogleLoginRequest(BaseModel):
    token: str

class GoogleRegisterRequest(BaseModel):
    token: str
    username: str
    location: str = ""
