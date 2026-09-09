package com.clipmind.controller;

import com.clipmind.dto.AnalyticsDashboardResponse;
import com.clipmind.dto.VideoAnalyticsResponse;
import com.clipmind.security.UserPrincipal;
import com.clipmind.service.AnalyticsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/analytics")
@CrossOrigin(origins = "*")
public class AnalyticsController {

    @Autowired
    private AnalyticsService analyticsService;

    @GetMapping("/dashboard")
    public ResponseEntity<AnalyticsDashboardResponse> getDashboardAnalytics(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        boolean isAdmin = userPrincipal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        AnalyticsDashboardResponse response = analyticsService.getDashboardAnalytics(userPrincipal.getId(), isAdmin);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/videos/{id}")
    public ResponseEntity<VideoAnalyticsResponse> getVideoAnalytics(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        boolean isAdmin = userPrincipal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        VideoAnalyticsResponse response = analyticsService.getVideoAnalytics(id, userPrincipal.getId(), isAdmin);
        return ResponseEntity.ok(response);
    }
}