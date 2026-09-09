package com.clipmind.service.impl;

import com.clipmind.dto.AnalyticsDashboardResponse;
import com.clipmind.dto.KeyMomentResponse;
import com.clipmind.dto.KeywordResponse;
import com.clipmind.dto.VideoAnalyticsResponse;
import com.clipmind.dto.VideoResponse;
import com.clipmind.model.Video;
import com.clipmind.model.VideoStatus;
import com.clipmind.repository.KeyMomentRepository;
import com.clipmind.repository.KeywordRepository;
import com.clipmind.repository.TranscriptRepository;
import com.clipmind.repository.VideoRepository;
import com.clipmind.service.AnalyticsService;
import com.clipmind.service.KeywordService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
public class AnalyticsServiceImpl implements AnalyticsService {

    @Autowired
    private VideoRepository videoRepository;

    @Autowired
    private TranscriptRepository transcriptRepository;

    @Autowired
    private KeyMomentRepository keyMomentRepository;

    @Autowired
    private KeywordRepository keywordRepository;

    @Autowired
    private KeywordService keywordService;

    @Override
    @Transactional(readOnly = true)
    public AnalyticsDashboardResponse getDashboardAnalytics(Long userId, boolean isAdmin) {
        List<Video> videos = isAdmin ? videoRepository.findAll() : videoRepository.findByUserIdOrderByCreatedAtDesc(userId);

        long totalVideos = videos.size();
        long completed = videos.stream().filter(v -> v.getStatus() == VideoStatus.COMPLETED).count();
        long failed = videos.stream().filter(v -> v.getStatus() == VideoStatus.FAILED).count();
        long processing = totalVideos - completed - failed;

        double totalDuration = videos.stream().filter(v -> v.getDuration() != null).mapToDouble(Video::getDuration).sum();
        double avgDuration = totalVideos > 0 ? totalDuration / totalVideos : 0.0;

        long totalWords = transcriptRepository.findAll().stream()
                .filter(t -> isAdmin || videos.stream().anyMatch(v -> v.getId().equals(t.getVideo().getId())))
                .mapToLong(t -> t.getWordCount() != null ? t.getWordCount() : 0)
                .sum();

        long totalKeyMoments = keyMomentRepository.count();
        long totalSummaries = completed;

        Map<String, Long> statusDistribution = new HashMap<>();
        statusDistribution.put("COMPLETED", completed);
        statusDistribution.put("PROCESSING", processing);
        statusDistribution.put("FAILED", failed);

        List<KeywordResponse> topKeywords = keywordService.getTopPlatformKeywords(10).stream()
                .map(k -> KeywordResponse.builder()
                        .id(k.getId())
                        .keyword(k.getKeyword())
                        .frequency(k.getFrequency())
                        .relevance(k.getRelevance())
                        .timestamp(k.getTimestamp())
                        .category(k.getCategory())
                        .build())
                .collect(Collectors.toList());

        List<VideoResponse> recentVideos = videos.stream().limit(5)
                .map(v -> VideoResponse.builder()
                        .id(v.getId())
                        .title(v.getTitle())
                        .description(v.getDescription())
                        .filename(v.getFilename())
                        .fileSize(v.getFileSize())
                        .contentType(v.getContentType())
                        .duration(v.getDuration())
                        .resolution(v.getResolution())
                        .codec(v.getCodec())
                        .status(v.getStatus().name())
                        .createdAt(v.getCreatedAt())
                        .updatedAt(v.getUpdatedAt())
                        .build())
                .collect(Collectors.toList());

        return AnalyticsDashboardResponse.builder()
                .totalVideos(totalVideos)
                .completedVideos(completed)
                .processingVideos(processing)
                .failedVideos(failed)
                .totalDuration(Math.round(totalDuration * 100.0) / 100.0)
                .avgDuration(Math.round(avgDuration * 100.0) / 100.0)
                .totalTranscriptWords(totalWords)
                .totalSummaries(totalSummaries)
                .totalKeyMoments(totalKeyMoments)
                .topPlatformKeywords(topKeywords)
                .recentVideos(recentVideos)
                .statusDistribution(statusDistribution)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public VideoAnalyticsResponse getVideoAnalytics(Long videoId, Long userId, boolean isAdmin) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new RuntimeException("Video not found with ID: " + videoId));

        if (!isAdmin && !video.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized to view analytics for video ID: " + videoId);
        }

        var transcript = transcriptRepository.findByVideoId(videoId).orElse(null);
        int wordCount = transcript != null && transcript.getWordCount() != null ? transcript.getWordCount() : 0;
        double duration = video.getDuration() != null && video.getDuration() > 0 ? video.getDuration() : 60.0;
        double wpm = (wordCount / (duration / 60.0));

        var keyMoments = keyMomentRepository.findByVideoIdOrderByStartTimeAsc(videoId);
        var keywords = keywordRepository.findByVideoIdOrderByFrequencyDesc(videoId);

        List<KeyMomentResponse> momentResponses = keyMoments.stream()
                .map(m -> KeyMomentResponse.builder()
                        .id(m.getId())
                        .videoId(videoId)
                        .title(m.getTitle())
                        .description(m.getDescription())
                        .startTime(m.getStartTime())
                        .endTime(m.getEndTime())
                        .relevanceScore(m.getRelevanceScore())
                        .keywords(m.getKeywords())
                        .formattedTimestamp(formatTime(m.getStartTime()) + " -> " + formatTime(m.getEndTime()))
                        .build())
                .collect(Collectors.toList());

        List<KeywordResponse> keywordResponses = keywords.stream()
                .map(k -> KeywordResponse.builder()
                        .id(k.getId())
                        .videoId(videoId)
                        .keyword(k.getKeyword())
                        .frequency(k.getFrequency())
                        .relevance(k.getRelevance())
                        .timestamp(k.getTimestamp())
                        .category(k.getCategory())
                        .build())
                .collect(Collectors.toList());

        return VideoAnalyticsResponse.builder()
                .videoId(videoId)
                .title(video.getTitle())
                .duration(video.getDuration())
                .wordCount(wordCount)
                .wordsPerMinute(Math.round(wpm * 10.0) / 10.0)
                .keyMomentsCount(keyMoments.size())
                .keywordsCount(keywords.size())
                .sentimentScore(0.88)
                .status(video.getStatus().name())
                .topKeywords(keywordResponses)
                .keyMoments(momentResponses)
                .build();
    }

    private String formatTime(Double seconds) {
        if (seconds == null) return "00:00";
        int totalSec = seconds.intValue();
        int mins = totalSec / 60;
        int secs = totalSec % 60;
        return String.format("%02d:%02d", mins, secs);
    }
}