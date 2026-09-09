package com.clipmind.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "summaries")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Summary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "video_id", nullable = false, unique = true)
    @JsonIgnore
    private Video video;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String shortSummary;

    @Column(columnDefinition = "LONGTEXT", nullable = false)
    private String detailedSummary;

    // JSON formatted arrays or newline-separated strings
    @Column(columnDefinition = "TEXT")
    private String keyPoints;

    @Column(columnDefinition = "TEXT")
    private String mainTopics;

    @Column(columnDefinition = "TEXT")
    private String actionItems;

    @Column(columnDefinition = "TEXT")
    private String keywords;

    @Column(length = 50)
    private String modelUsed;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}