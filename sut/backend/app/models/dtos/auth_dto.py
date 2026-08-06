from pydantic import BaseModel

class LoginRequest(BaseModel):
    identifier: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    username: str
    nombre: str
    apellidos: str
    ubicacion: str

class PasswordResetRequest(BaseModel):
    email: str

class ProfileUpdateRequest(BaseModel):
    nombre: str
    apellidos: str
    ubicacion: str = ""
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
    ubicacion: str = ""
