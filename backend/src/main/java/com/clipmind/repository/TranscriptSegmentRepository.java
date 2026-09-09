package com.clipmind.repository;

import com.clipmind.model.TranscriptSegment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TranscriptSegmentRepository extends JpaRepository<TranscriptSegment, Long> {
    List<TranscriptSegment> findByTranscriptIdOrderByStartTimeAsc(Long transcriptId);
}