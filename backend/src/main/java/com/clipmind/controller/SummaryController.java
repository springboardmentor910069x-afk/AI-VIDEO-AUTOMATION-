package com.clipmind.controller;

import com.clipmind.dto.SummaryResponse;
import com.clipmind.model.Summary;
import com.clipmind.model.Transcript;
import com.clipmind.model.Video;
import com.clipmind.repository.SummaryRepository;
import com.clipmind.repository.TranscriptRepository;
import com.clipmind.security.UserPrincipal;
import com.clipmind.service.AiSummaryService;
import com.clipmind.service.VideoService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/videos/{id}/summary")
@CrossOrigin(origins = "*")
public class SummaryController {

    @Autowired
    private VideoService videoService;

    @Autowired
    private SummaryRepository summaryRepository;

    @Autowired
    private TranscriptRepository transcriptRepository;

    @Autowired
    private AiSummaryService aiSummaryService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @GetMapping
    public ResponseEntity<SummaryResponse> getSummary(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Video video = videoService.getVideoById(id, userPrincipal.getId());
        Summary summary = summaryRepository.findByVideoId(video.getId())
                .orElseThrow(() -> new RuntimeException("Summary not found or still generating."));

        return ResponseEntity.ok(mapToResponse(summary));
    }

    @PostMapping("/regenerate")
    public ResponseEntity<SummaryResponse> regenerateSummary(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Video video = videoService.getVideoById(id, userPrincipal.getId());
        Transcript transcript = transcriptRepository.findByVideoId(video.getId())
                .orElseThrow(() -> new RuntimeException("Transcript required before generating summary."));

        Summary regenerated = aiSummaryService.regenerateSummary(video, transcript);
        return ResponseEntity.ok(mapToResponse(regenerated));
    }

    private SummaryResponse mapToResponse(Summary summary) {
        List<String> keyPoints = parseList(summary.getKeyPoints());
        List<String> mainTopics = parseList(summary.getMainTopics());
        List<String> actionItems = parseList(summary.getActionItems());
        List<String> keywords = parseList(summary.getKeywords());

        return SummaryResponse.builder()
                .id(summary.getId())
                .videoId(summary.getVideo().getId())
                .shortSummary(summary.getShortSummary())
                .detailedSummary(summary.getDetailedSummary())
                .keyPoints(keyPoints)
                .mainTopics(mainTopics)
                .actionItems(actionItems)
                .keywords(keywords)
                .modelUsed(summary.getModelUsed())
                .createdAt(summary.getCreatedAt())
                .build();
    }

    private List<String> parseList(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of(json.split("\n"));
        }
    }
}