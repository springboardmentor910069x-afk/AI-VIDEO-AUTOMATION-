package com.clipmind.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VideoAnalyticsResponse {
    private Long videoId;
    private String title;
    private Double duration;
    private Integer wordCount;
    private Double wordsPerMinute;
    private Integer keyMomentsCount;
    private Integer keywordsCount;
    private Double sentimentScore;
    private String status;
    private List<KeywordResponse> topKeywords;
    private List<KeyMomentResponse> keyMoments;
}