package com.clipmind.controller;

import com.clipmind.dto.KeywordResponse;
import com.clipmind.model.Keyword;
import com.clipmind.model.Video;
import com.clipmind.security.UserPrincipal;
import com.clipmind.service.KeywordService;
import com.clipmind.service.VideoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/videos/{id}/keywords")
@CrossOrigin(origins = "*")
public class KeywordController {

    @Autowired
    private VideoService videoService;

    @Autowired
    private KeywordService keywordService;

    @GetMapping
    public ResponseEntity<List<KeywordResponse>> getKeywords(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Video video = videoService.getVideoById(id, userPrincipal.getId());
        List<Keyword> keywords = keywordService.getKeywordsByVideoId(video.getId());

        List<KeywordResponse> response = keywords.stream()
                .map(k -> KeywordResponse.builder()
                        .id(k.getId())
                        .videoId(video.getId())
                        .keyword(k.getKeyword())
                        .frequency(k.getFrequency())
                        .relevance(k.getRelevance())
                        .timestamp(k.getTimestamp())
                        .category(k.getCategory())
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }
}