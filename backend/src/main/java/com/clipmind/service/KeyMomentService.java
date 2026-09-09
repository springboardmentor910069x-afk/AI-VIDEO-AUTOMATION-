package com.clipmind.service;

import com.clipmind.model.KeyMoment;
import com.clipmind.model.Transcript;
import com.clipmind.model.Video;
import java.util.List;

public interface KeyMomentService {
    List<KeyMoment> detectKeyMoments(Video video, Transcript transcript);
    List<KeyMoment> getKeyMomentsByVideoId(Long videoId);
}