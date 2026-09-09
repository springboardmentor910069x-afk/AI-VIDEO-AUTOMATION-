package com.clipmind.repository;

import com.clipmind.model.KeyMoment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KeyMomentRepository extends JpaRepository<KeyMoment, Long> {
    List<KeyMoment> findByVideoIdOrderByStartTimeAsc(Long videoId);
    void deleteByVideoId(Long videoId);
}