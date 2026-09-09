package com.clipmind.service;

import com.clipmind.model.Keyword;
import com.clipmind.model.Transcript;
import com.clipmind.model.Video;
import java.util.List;

public interface KeywordService {
    List<Keyword> extractKeywords(Video video, Transcript transcript);
    List<Keyword> getKeywordsByVideoId(Long videoId);
    List<Keyword> getTopPlatformKeywords(int limit);
}