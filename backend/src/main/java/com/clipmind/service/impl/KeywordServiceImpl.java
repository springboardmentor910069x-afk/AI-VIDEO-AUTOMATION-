package com.clipmind.service.impl;

import com.clipmind.model.Keyword;
import com.clipmind.model.Transcript;
import com.clipmind.model.Video;
import com.clipmind.repository.KeywordRepository;
import com.clipmind.service.KeywordService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class KeywordServiceImpl implements KeywordService {

    @Autowired
    private KeywordRepository keywordRepository;

    private static final Set<String> STOP_WORDS = new HashSet<>(Arrays.asList(
            "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
            "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
            "to", "was", "were", "will", "with", "this", "today", "we", "going",
            "explore", "detail", "everyone", "welcome", "lets", "dive"
    ));

    @Override
    @Transactional
    public List<Keyword> extractKeywords(Video video, Transcript transcript) {
        log.info("Extracting keywords for video ID: {}", video.getId());

        var existing = keywordRepository.findByVideoIdOrderByFrequencyDesc(video.getId());
        if (!existing.isEmpty()) {
            return existing;
        }

        String fullText = transcript != null ? transcript.getFullText() : video.getTitle();
        String[] words = fullText.toLowerCase().replaceAll("[^a-zA-Z0-9\\s]", "").split("\\s+");

        Map<String, Integer> freqMap = new HashMap<>();
        for (String word : words) {
            if (word.length() > 3 && !STOP_WORDS.contains(word)) {
                freqMap.put(word, freqMap.getOrDefault(word, 0) + 1);
            }
        }

        // Add title keywords with high relevance
        String[] titleWords = video.getTitle().toLowerCase().replaceAll("[^a-zA-Z0-9\\s]", "").split("\\s+");
        for (String tw : titleWords) {
            if (tw.length() > 2 && !STOP_WORDS.contains(tw)) {
                freqMap.put(tw, freqMap.getOrDefault(tw, 2) + 3);
            }
        }

        List<Keyword> keywords = new ArrayList<>();
        double duration = video.getDuration() != null ? video.getDuration() : 60.0;
        int index = 0;

        for (Map.Entry<String, Integer> entry : freqMap.entrySet()) {
            if (entry.getValue() >= 1) {
                double rel = Math.min(0.99, 0.5 + (entry.getValue() * 0.1));
                double ts = (index * (duration / Math.max(1, freqMap.size()))) % duration;

                keywords.add(Keyword.builder()
                        .video(video)
                        .keyword(entry.getKey())
                        .frequency(entry.getValue())
                        .relevance(Math.round(rel * 100.0) / 100.0)
                        .timestamp(Math.round(ts * 10.0) / 10.0)
                        .category("Topic")
                        .build());
                index++;
            }
        }

        // Sort by frequency descending and take top 15
        keywords.sort((a, b) -> b.getFrequency().compareTo(a.getFrequency()));
        List<Keyword> topKeywords = keywords.stream().limit(15).collect(Collectors.toList());

        return keywordRepository.saveAll(topKeywords);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Keyword> getKeywordsByVideoId(Long videoId) {
        return keywordRepository.findByVideoIdOrderByFrequencyDesc(videoId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Keyword> getTopPlatformKeywords(int limit) {
        return keywordRepository.findAll().stream()
                .sorted((a, b) -> b.getFrequency().compareTo(a.getFrequency()))
                .limit(limit)
                .collect(Collectors.toList());
    }
}