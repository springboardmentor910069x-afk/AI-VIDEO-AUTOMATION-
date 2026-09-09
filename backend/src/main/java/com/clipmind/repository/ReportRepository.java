package com.clipmind.repository;

import com.clipmind.model.Report;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {
    Optional<Report> findByVideoId(Long videoId);
    void deleteByVideoId(Long videoId);
}