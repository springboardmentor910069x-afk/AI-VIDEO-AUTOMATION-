package com.clipmind.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "transcripts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transcript {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "video_id", nullable = false, unique = true)
    @JsonIgnore
    private Video video;

    @Column(columnDefinition = "LONGTEXT", nullable = false)
    private String fullText;

    @Column(length = 20)
    private String language;

    private Double confidence;

    private Integer wordCount;

    @OneToMany(mappedBy = "transcript", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("startTime ASC")
    @Builder.Default
    private List<TranscriptSegment> segments = new ArrayList<>();

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (wordCount == null && fullText != null) {
            wordCount = fullText.trim().isEmpty() ? 0 : fullText.trim().split("\\s+").length;
        }
    }
}