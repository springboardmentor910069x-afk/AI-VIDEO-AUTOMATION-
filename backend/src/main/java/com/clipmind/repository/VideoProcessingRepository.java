package com.clipmind.repository;

import com.clipmind.model.VideoProcessing;
import com.clipmind.model.VideoStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface VideoProcessingRepository extends JpaRepository<VideoProcessing, Long> {
    List<VideoProcessing> findByVideoId(Long videoId);
    List<VideoProcessing> findByVideoIdAndStatus(Long videoId, VideoStatus status);
}
