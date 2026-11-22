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
    first_name: string;
    last_name: string;
    ubicacion?: string;
    is_google?: boolean;
}
