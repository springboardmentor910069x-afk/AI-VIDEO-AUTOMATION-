package com.clipmind.repository;

import com.clipmind.model.Summary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SummaryRepository extends JpaRepository<Summary, Long> {
    Optional<Summary> findByVideoId(Long videoId);
    void deleteByVideoId(Long videoId);
}