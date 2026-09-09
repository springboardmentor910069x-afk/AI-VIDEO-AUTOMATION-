package com.clipmind.service;

import com.clipmind.model.User;
import com.clipmind.model.Video;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

public interface VideoService {
    Video uploadVideo(MultipartFile file, String title, String description, User user);
    void processVideoAsync(Long videoId);
    List<Video> getAllUserVideos(Long userId);
    Video getVideoById(Long id, Long userId);
    void deleteVideo(Long id, Long userId);
}
