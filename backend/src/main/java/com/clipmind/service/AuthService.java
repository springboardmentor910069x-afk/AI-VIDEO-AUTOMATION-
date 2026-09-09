package com.clipmind.service;

import com.clipmind.dto.AuthResponse;
import com.clipmind.dto.LoginRequest;
import com.clipmind.dto.RegisterRequest;

public interface AuthService {
    AuthResponse register(RegisterRequest registerRequest);
    AuthResponse login(LoginRequest loginRequest);
}
