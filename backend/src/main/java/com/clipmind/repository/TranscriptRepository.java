package com.clipmind.repository;

import com.clipmind.model.Transcript;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TranscriptRepository extends JpaRepository<Transcript, Long> {
    Optional<Transcript> findByVideoId(Long videoId);
    void deleteByVideoId(Long videoId);
}