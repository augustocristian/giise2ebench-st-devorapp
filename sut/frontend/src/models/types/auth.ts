export interface LoginResponse {
    message: string;
    user: User;
}

export interface RegisterResponse {
    message: string;
    user: User;
}

export interface User {
    username: string;
    email: string;
    nombre: string;
    apellidos: string;
    ubicacion?: string;
    is_google?: boolean;
}
