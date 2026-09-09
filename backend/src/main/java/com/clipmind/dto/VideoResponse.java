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
public class VideoResponse {
    private Long id;
    private String title;
    private String description;
    private String filename;
    private Long fileSize;
    private String contentType;
    private Double duration;
    private String resolution;
    private String codec;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
