package com.clipmind.service;

import com.clipmind.dto.AnalyticsDashboardResponse;
import com.clipmind.dto.VideoAnalyticsResponse;

public interface AnalyticsService {
    AnalyticsDashboardResponse getDashboardAnalytics(Long userId, boolean isAdmin);
    VideoAnalyticsResponse getVideoAnalytics(Long videoId, Long userId, boolean isAdmin);
}