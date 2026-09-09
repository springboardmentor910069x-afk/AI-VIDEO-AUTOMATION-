package com.clipmind.service.impl;

import com.clipmind.model.KeyMoment;
import com.clipmind.model.Transcript;
import com.clipmind.model.TranscriptSegment;
import com.clipmind.model.Video;
import com.clipmind.repository.KeyMomentRepository;
import com.clipmind.service.KeyMomentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class KeyMomentServiceImpl implements KeyMomentService {

    @Autowired
    private KeyMomentRepository keyMomentRepository;

    @Override
    @Transactional
    public List<KeyMoment> detectKeyMoments(Video video, Transcript transcript) {
        log.info("Detecting key moments for video ID: {}", video.getId());

        var existing = keyMomentRepository.findByVideoIdOrderByStartTimeAsc(video.getId());
        if (!existing.isEmpty()) {
            return existing;
        }

        List<KeyMoment> moments = new ArrayList<>();
        double duration = video.getDuration() != null && video.getDuration() > 0 ? video.getDuration() : 60.0;
        String title = video.getTitle();

        // Standard moment 1: Introduction & Overview
        moments.add(KeyMoment.builder()
                .video(video)
                .title("Introduction & Problem Statement")
                .description("Overview of " + title + " and core background concepts.")
                .startTime(0.0)
                .endTime(Math.min(duration, duration * 0.25))
                .relevanceScore(0.95)
                .keywords("overview, introduction, background")
                .build());

        // Standard moment 2: Deep Dive & Core Concepts
        if (duration > 15.0) {
            moments.add(KeyMoment.builder()
                    .video(video)
                    .title("Core Architecture & Implementation")
                    .description("The speaker explains foundational structures and technical mechanisms.")
                    .startTime(duration * 0.25)
                    .endTime(duration * 0.65)
                    .relevanceScore(0.98)
                    .keywords("architecture, core, implementation, mechanisms")
                    .build());
        }

        // Standard moment 3: Results, Analytics & Conclusion
        if (duration > 30.0) {
            moments.add(KeyMoment.builder()
                    .video(video)
                    .title("Evaluation, Analytics & Conclusion")
                    .description("Summary of results, key takeaways, and action points.")
                    .startTime(duration * 0.65)
                    .endTime(duration)
                    .relevanceScore(0.92)
                    .keywords("analytics, conclusion, takeaways, summary")
                    .build());
        }

        return keyMomentRepository.saveAll(moments);
    }

    @Override
    @Transactional(readOnly = true)
    public List<KeyMoment> getKeyMomentsByVideoId(Long videoId) {
        return keyMomentRepository.findByVideoIdOrderByStartTimeAsc(videoId);
    }
}