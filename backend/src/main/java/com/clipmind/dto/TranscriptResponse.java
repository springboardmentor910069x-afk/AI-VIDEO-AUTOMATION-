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
public class TranscriptResponse {
    private Long id;
    private Long videoId;
    private String fullText;
    private String language;
    private Double confidence;
    private Integer wordCount;
    private List<SegmentDto> segments;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SegmentDto {
        private Long id;
        private Double startTime;
        private Double endTime;
        private String text;
        private String speaker;
        private Double confidence;
    }
}