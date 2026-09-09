package com.clipmind.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReportResponse {
    private Long id;
    private Long videoId;
    private String videoTitle;
    private String reportType;
    private String content;
    private LocalDateTime generatedAt;
}