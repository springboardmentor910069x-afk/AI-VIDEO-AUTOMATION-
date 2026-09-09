package com.clipmind.controller;

import com.clipmind.dto.AdminUserResponse;
import com.clipmind.dto.AnalyticsDashboardResponse;
import com.clipmind.dto.VideoResponse;
import com.clipmind.service.AdminService;
import com.clipmind.service.AnalyticsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@CrossOrigin(origins = "*")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @Autowired
    private AnalyticsService analyticsService;

    @GetMapping("/users")
    public ResponseEntity<List<AdminUserResponse>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<AdminUserResponse> updateUserRole(
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> body) {
        String role = body.get("role");
        return ResponseEntity.ok(adminService.updateUserRole(id, role));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<String> deleteUser(@PathVariable("id") Long id) {
        adminService.deleteUser(id);
        return ResponseEntity.ok("User deleted successfully");
    }

    @GetMapping("/videos")
    public ResponseEntity<List<VideoResponse>> getAllVideos() {
        return ResponseEntity.ok(adminService.getAllPlatformVideos());
    }

    @GetMapping("/analytics")
    public ResponseEntity<AnalyticsDashboardResponse> getAdminAnalytics() {
        return ResponseEntity.ok(analyticsService.getDashboardAnalytics(null, true));
    }
}