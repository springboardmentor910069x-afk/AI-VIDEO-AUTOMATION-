package com.clipmind.service;

import com.clipmind.model.Transcript;
import com.clipmind.model.Video;
import java.nio.file.Path;

public interface WhisperService {
    Transcript transcribeAudio(Video video, Path audioPath);
}