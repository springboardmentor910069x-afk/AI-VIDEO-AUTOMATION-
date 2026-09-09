package com.clipmind.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnalyticsDashboardResponse {
    private Long totalVideos;
    private Long completedVideos;
    private Long processingVideos;
    private Long failedVideos;
    private Double totalDuration;
    private Double avgDuration;
    private Long totalTranscriptWords;
    private Long totalSummaries;
    private Long totalKeyMoments;
    private List<KeywordResponse> topPlatformKeywords;
    private List<VideoResponse> recentVideos;
    private Map<String, Long> statusDistribution;
}