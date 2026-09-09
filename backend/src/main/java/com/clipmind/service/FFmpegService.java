package com.clipmind.service;

import com.clipmind.dto.VideoMetadata;
import java.nio.file.Path;

public interface FFmpegService {
    boolean isValidVideo(Path videoPath);
    VideoMetadata extractMetadata(Path videoPath);
    Path generateThumbnail(Path videoPath, Path thumbnailOutputDir, String thumbnailName);
    Path extractAudio(Path videoPath, Path audioOutputDir, String audioName);
}

