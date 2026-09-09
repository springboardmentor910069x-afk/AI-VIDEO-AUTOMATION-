package com.clipmind.service.impl;

import com.clipmind.dto.ReportResponse;
import com.clipmind.model.*;
import com.clipmind.repository.*;
import com.clipmind.service.ReportService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@Slf4j
public class ReportServiceImpl implements ReportService {

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private VideoRepository videoRepository;

    @Autowired
    private SummaryRepository summaryRepository;

    @Autowired
    private TranscriptRepository transcriptRepository;

    @Autowired
    private KeyMomentRepository keyMomentRepository;

    @Autowired
    private KeywordRepository keywordRepository;

    @Override
    @Transactional
    public Report generateReport(Video video) {
        log.info("Generating comprehensive intelligence report for video ID: {}", video.getId());

        var existing = reportRepository.findByVideoId(video.getId());
        if (existing.isPresent()) {
            return existing.get();
        }

        var summary = summaryRepository.findByVideoId(video.getId()).orElse(null);
        var transcript = transcriptRepository.findByVideoId(video.getId()).orElse(null);
        List<KeyMoment> moments = keyMomentRepository.findByVideoIdOrderByStartTimeAsc(video.getId());
        List<Keyword> keywords = keywordRepository.findByVideoIdOrderByFrequencyDesc(video.getId());

        StringBuilder md = new StringBuilder();
        md.append("# ClipMind AI — Video Intelligence Report\n\n");
        md.append("**Video Title:** ").append(video.getTitle()).append("\n");
        md.append("**Duration:** ").append(video.getDuration() != null ? String.format("%.1f seconds", video.getDuration()) : "N/A").append("\n");
        md.append("**Resolution:** ").append(video.getResolution() != null ? video.getResolution() : "N/A").append("\n");
        md.append("**Codec:** ").append(video.getCodec() != null ? video.getCodec() : "N/A").append("\n");
        md.append("**Generated At:** ").append(java.time.LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)).append("\n\n");

        md.append("## Executive Summary\n\n");
        if (summary != null) {
            md.append(summary.getDetailedSummary()).append("\n\n");
        } else {
            md.append("No summary available.\n\n");
        }

        md.append("## Key Moments & Timestamps\n\n");
        if (moments.isEmpty()) {
            md.append("No key moments extracted.\n\n");
        } else {
            for (KeyMoment m : moments) {
                int startM = (int) (m.getStartTime() / 60);
                int startS = (int) (m.getStartTime() % 60);
                int endM = (int) (m.getEndTime() / 60);
                int endS = (int) (m.getEndTime() % 60);
                md.append(String.format("### %s (`%02d:%02d` -> `%02d:%02d`)\n", m.getTitle(), startM, startS, endM, endS));
                md.append(m.getDescription()).append("\n\n");
            }
        }

        md.append("## Top Extracted Keywords\n\n");
        if (keywords.isEmpty()) {
            md.append("No keywords extracted.\n\n");
        } else {
            for (Keyword k : keywords) {
                md.append(String.format("- **%s** (Frequency: %d, Relevance: %.0f%%)\n", k.getKeyword(), k.getFrequency(), k.getRelevance() * 100));
            }
            md.append("\n");
        }

        md.append("## Full Transcript\n\n");
        if (transcript != null) {
            md.append(transcript.getFullText()).append("\n\n");
        } else {
            md.append("No transcript available.\n\n");
        }

        Report report = Report.builder()
                .video(video)
                .reportType("HIGHLIGHT_INTELLIGENCE")
                .content(md.toString())
                .build();

        return reportRepository.save(report);
    }

    @Override
    @Transactional
    public ReportResponse getReportByVideoId(Long videoId, Long userId, boolean isAdmin) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new RuntimeException("Video not found with ID: " + videoId));

        if (!isAdmin && !video.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized to access report for video ID: " + videoId);
        }

        Report report = reportRepository.findByVideoId(videoId)
                .orElseGet(() -> generateReport(video));

        return ReportResponse.builder()
                .id(report.getId())
                .videoId(videoId)
                .videoTitle(video.getTitle())
                .reportType(report.getReportType())
                .content(report.getContent())
                .generatedAt(report.getGeneratedAt())
                .build();
    }
}