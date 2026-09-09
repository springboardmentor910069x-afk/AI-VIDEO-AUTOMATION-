package com.clipmind.service;

import com.clipmind.dto.UserProfileResponse;

public interface UserService {
    UserProfileResponse getUserProfile(Long id);
}
