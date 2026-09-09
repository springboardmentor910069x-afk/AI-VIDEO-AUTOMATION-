package com.clipmind.controller;

import com.clipmind.dto.KeyMomentResponse;
import com.clipmind.model.KeyMoment;
import com.clipmind.model.Video;
import com.clipmind.security.UserPrincipal;
import com.clipmind.service.KeyMomentService;
import com.clipmind.service.VideoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/videos/{id}/key-moments")
@CrossOrigin(origins = "*")
public class KeyMomentController {

    @Autowired
    private VideoService videoService;

    @Autowired
    private KeyMomentService keyMomentService;

    @GetMapping
    public ResponseEntity<List<KeyMomentResponse>> getKeyMoments(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Video video = videoService.getVideoById(id, userPrincipal.getId());
        List<KeyMoment> moments = keyMomentService.getKeyMomentsByVideoId(video.getId());

        List<KeyMomentResponse> response = moments.stream()
                .map(m -> KeyMomentResponse.builder()
                        .id(m.getId())
                        .videoId(video.getId())
                        .title(m.getTitle())
                        .description(m.getDescription())
                        .startTime(m.getStartTime())
                        .endTime(m.getEndTime())
                        .relevanceScore(m.getRelevanceScore())
                        .keywords(m.getKeywords())
                        .formattedTimestamp(formatTime(m.getStartTime()) + " -> " + formatTime(m.getEndTime()))
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    private String formatTime(Double seconds) {
        if (seconds == null) return "00:00";
        int totalSec = seconds.intValue();
        int mins = totalSec / 60;
        int secs = totalSec % 60;
        return String.format("%02d:%02d", mins, secs);
    }
}