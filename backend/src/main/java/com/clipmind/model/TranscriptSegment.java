package com.clipmind.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "transcript_segments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TranscriptSegment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transcript_id", nullable = false)
    @JsonIgnore
    private Transcript transcript;

    @Column(nullable = false)
    private Double startTime; // in seconds

    @Column(nullable = false)
    private Double endTime; // in seconds

    @Column(columnDefinition = "TEXT", nullable = false)
    private String text;

    @Column(length = 50)
    private String speaker;

    private Double confidence;
}