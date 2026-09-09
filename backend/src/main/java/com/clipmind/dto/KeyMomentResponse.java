package com.clipmind.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KeyMomentResponse {
    private Long id;
    private Long videoId;
    private String title;
    private String description;
    private Double startTime;
    private Double endTime;
    private Double relevanceScore;
    private String keywords;
    private String formattedTimestamp;
}