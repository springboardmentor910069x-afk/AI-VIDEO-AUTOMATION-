package com.clipmind.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SummaryResponse {
    private Long id;
    private Long videoId;
    private String shortSummary;
    private String detailedSummary;
    private List<String> keyPoints;
    private List<String> mainTopics;
    private List<String> actionItems;
    private List<String> keywords;
    private String modelUsed;
    private LocalDateTime createdAt;
}