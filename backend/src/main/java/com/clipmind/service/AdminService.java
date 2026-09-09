package com.clipmind.service;

import com.clipmind.dto.AdminUserResponse;
import com.clipmind.dto.VideoResponse;
import java.util.List;

public interface AdminService {
    List<AdminUserResponse> getAllUsers();
    AdminUserResponse updateUserRole(Long userId, String role);
    void deleteUser(Long userId);
    List<VideoResponse> getAllPlatformVideos();
}