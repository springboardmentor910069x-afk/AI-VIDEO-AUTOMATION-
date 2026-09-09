package com.clipmind.controller;

import com.clipmind.dto.TranscriptResponse;
import com.clipmind.model.Transcript;
import com.clipmind.model.Video;
import com.clipmind.repository.TranscriptRepository;
import com.clipmind.security.UserPrincipal;
import com.clipmind.service.VideoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/videos/{id}/transcript")
@CrossOrigin(origins = "*")
public class TranscriptController {

    @Autowired
    private VideoService videoService;

    @Autowired
    private TranscriptRepository transcriptRepository;

    @GetMapping
    public ResponseEntity<TranscriptResponse> getTranscript(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        boolean isAdmin = userPrincipal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        Video video = videoService.getVideoById(id, userPrincipal.getId());

        Transcript transcript = transcriptRepository.findByVideoId(video.getId())
                .orElseThrow(() -> new RuntimeException("Transcript not found or still generating."));

        var segmentDtos = transcript.getSegments().stream()
                .map(s -> TranscriptResponse.SegmentDto.builder()
                        .id(s.getId())
                        .startTime(s.getStartTime())
                        .endTime(s.getEndTime())
                        .text(s.getText())
                        .speaker(s.getSpeaker())
                        .confidence(s.getConfidence())
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(TranscriptResponse.builder()
                .id(transcript.getId())
                .videoId(video.getId())
                .fullText(transcript.getFullText())
                .language(transcript.getLanguage())
                .confidence(transcript.getConfidence())
                .wordCount(transcript.getWordCount())
                .segments(segmentDtos)
                .build());
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportTranscript(
            @PathVariable("id") Long id,
            @RequestParam(value = "format", defaultValue = "txt") String format,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Video video = videoService.getVideoById(id, userPrincipal.getId());
        Transcript transcript = transcriptRepository.findByVideoId(video.getId())
                .orElseThrow(() -> new RuntimeException("Transcript not found."));

        StringBuilder sb = new StringBuilder();
        sb.append("TRANSCRIPT FOR: ").append(video.getTitle()).append("\n\n");

        for (var seg : transcript.getSegments()) {
            int mins = (int) (seg.getStartTime() / 60);
            int secs = (int) (seg.getStartTime() % 60);
            sb.append(String.format("[%02d:%02d] %s\n", mins, secs, seg.getText()));
        }

        byte[] bytes = sb.toString().getBytes();
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + video.getTitle() + "_transcript.txt\"")
                .body(bytes);
    }
}