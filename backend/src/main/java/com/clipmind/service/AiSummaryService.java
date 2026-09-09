package com.clipmind.service;

import com.clipmind.model.Summary;
import com.clipmind.model.Transcript;
import com.clipmind.model.Video;

public interface AiSummaryService {
    Summary generateSummary(Video video, Transcript transcript);
    Summary regenerateSummary(Video video, Transcript transcript);
}