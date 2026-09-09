package com.clipmind.service.impl;

import com.clipmind.dto.AdminUserResponse;
import com.clipmind.dto.VideoResponse;
import com.clipmind.exception.ResourceNotFoundException;
import com.clipmind.model.Role;
import com.clipmind.model.User;
import com.clipmind.repository.UserRepository;
import com.clipmind.repository.VideoRepository;
import com.clipmind.service.AdminService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
public class AdminServiceImpl implements AdminService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private VideoRepository videoRepository;

    @Override
    @Transactional(readOnly = true)
    public List<AdminUserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(u -> AdminUserResponse.builder()
                        .id(u.getId())
                        .username(u.getUsername())
                        .email(u.getEmail())
                        .role(u.getRole().name())
                        .videoCount((long) videoRepository.findByUserIdOrderByCreatedAtDesc(u.getId()).size())
                        .createdAt(u.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public AdminUserResponse updateUserRole(Long userId, String roleStr) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + userId));

        Role role = Role.valueOf(roleStr.toUpperCase());
        user.setRole(role);
        User saved = userRepository.save(user);

        return AdminUserResponse.builder()
                .id(saved.getId())
                .username(saved.getUsername())
                .email(saved.getEmail())
                .role(saved.getRole().name())
                .videoCount((long) videoRepository.findByUserIdOrderByCreatedAtDesc(saved.getId()).size())
                .createdAt(saved.getCreatedAt())
                .build();
    }

    @Override
    @Transactional
    public void deleteUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found with ID: " + userId);
        }
        userRepository.deleteById(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<VideoResponse> getAllPlatformVideos() {
        return videoRepository.findAll().stream()
                .map(v -> VideoResponse.builder()
                        .id(v.getId())
                        .title(v.getTitle())
                        .description(v.getDescription())
                        .filename(v.getFilename())
                        .fileSize(v.getFileSize())
                        .contentType(v.getContentType())
                        .duration(v.getDuration())
                        .resolution(v.getResolution())
                        .codec(v.getCodec())
                        .status(v.getStatus().name())
                        .createdAt(v.getCreatedAt())
                        .updatedAt(v.getUpdatedAt())
                        .build())
                .collect(Collectors.toList());
    }
}