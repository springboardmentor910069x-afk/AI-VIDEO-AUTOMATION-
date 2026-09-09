-- Create Database if not exists
CREATE DATABASE IF NOT EXISTS clipmind_db;
USE clipmind_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'ROLE_USER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Videos Table
CREATE TABLE IF NOT EXISTS videos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(512) NOT NULL,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(100),
    duration DOUBLE,
    resolution VARCHAR(30),
    codec VARCHAR(50),
    thumbnail_path VARCHAR(512),
    status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED',
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_video_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Video Processing History Table
CREATE TABLE IF NOT EXISTS video_processing (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    video_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    task_type VARCHAR(50) NOT NULL,
    error_message TEXT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    CONSTRAINT fk_processing_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Transcripts Table
CREATE TABLE IF NOT EXISTS transcripts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    video_id BIGINT NOT NULL UNIQUE,
    full_text LONGTEXT NOT NULL,
    language VARCHAR(20),
    confidence DOUBLE,
    word_count INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transcript_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Transcript Segments Table
CREATE TABLE IF NOT EXISTS transcript_segments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transcript_id BIGINT NOT NULL,
    start_time DOUBLE NOT NULL,
    end_time DOUBLE NOT NULL,
    text TEXT NOT NULL,
    speaker VARCHAR(50),
    confidence DOUBLE,
    CONSTRAINT fk_segment_transcript FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Summaries Table
CREATE TABLE IF NOT EXISTS summaries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    video_id BIGINT NOT NULL UNIQUE,
    short_summary TEXT NOT NULL,
    detailed_summary LONGTEXT NOT NULL,
    key_points TEXT,
    main_topics TEXT,
    action_items TEXT,
    keywords TEXT,
    model_used VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_summary_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Key Moments Table
CREATE TABLE IF NOT EXISTS key_moments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    video_id BIGINT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    start_time DOUBLE NOT NULL,
    end_time DOUBLE NOT NULL,
    relevance_score DOUBLE,
    keywords VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_moment_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Keywords Table
CREATE TABLE IF NOT EXISTS keywords (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    video_id BIGINT NOT NULL,
    keyword VARCHAR(100) NOT NULL,
    frequency INT,
    relevance DOUBLE,
    timestamp DOUBLE,
    category VARCHAR(50),
    CONSTRAINT fk_keyword_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    video_id BIGINT NOT NULL UNIQUE,
    report_type VARCHAR(50) NOT NULL,
    content LONGTEXT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_report_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexing for performance
CREATE INDEX idx_user_username ON users(username);
CREATE INDEX idx_video_user ON videos(user_id);
CREATE INDEX idx_video_status ON videos(status);
CREATE INDEX idx_processing_video ON video_processing(video_id);
CREATE INDEX idx_segment_transcript ON transcript_segments(transcript_id);
CREATE INDEX idx_moment_video ON key_moments(video_id);
CREATE INDEX idx_keyword_video ON keywords(video_id);