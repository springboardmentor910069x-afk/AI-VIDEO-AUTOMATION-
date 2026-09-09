package com.clipmind.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KeywordResponse {
    private Long id;
    private Long videoId;
    private String keyword;
    private Integer frequency;
    private Double relevance;
    private Double timestamp;
    private String category;
}