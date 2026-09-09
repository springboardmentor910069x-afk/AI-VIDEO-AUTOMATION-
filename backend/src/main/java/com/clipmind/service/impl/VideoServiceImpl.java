package com.clipmind.service.impl;

import com.clipmind.exception.ResourceNotFoundException;
import com.clipmind.model.*;
import com.clipmind.repository.*;
import com.clipmind.service.*;
import com.clipmind.dto.VideoMetadata;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;

@Service
@Slf4j
public class VideoServiceImpl implements VideoService {

    @Autowired
    private VideoRepository videoRepository;

    @Autowired
    private VideoProcessingRepository videoProcessingRepository;

    @Autowired
    private TranscriptRepository transcriptRepository;

    @Autowired
    private SummaryRepository summaryRepository;

    @Autowired
    private KeyMomentRepository keyMomentRepository;

    @Autowired
    private KeywordRepository keywordRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private FileStorageService fileStorageService;

    @Autowired
    private FFmpegService ffmpegService;

    @Autowired
    private WhisperService whisperService;

    @Autowired
    private AiSummaryService aiSummaryService;

    @Autowired
    private KeyMomentService keyMomentService;

    @Autowired
    private KeywordService keywordService;

    @Autowired
    private ReportService reportService;


    @Override
    @Transactional
    public Video uploadVideo(MultipartFile file, String title, String description, User user) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload empty file");
        }

        // 1. Store video file to disk
        String storedFileName = fileStorageService.storeFile(file, "videos");
        Path storedFilePath = fileStorageService.getFilePath(storedFileName, "videos");

        // 2. Create database video record
        Video video = Video.builder()
                .title(title)
                .description(description)
                .filename(storedFileName)
                .filepath(storedFilePath.toAbsolutePath().toString())
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .status(VideoStatus.UPLOADED)
                .user(user)
                .build();

        Video savedVideo = videoRepository.save(video);

        // 3. Log initial task entry in processing history
        VideoProcessing task = VideoProcessing.builder()
                .video(savedVideo)
                .status(VideoStatus.QUEUED)
                .taskType("MEDIA_AND_AI_PROCESSING_PIPELINE")
                .startedAt(LocalDateTime.now())
                .build();
        videoProcessingRepository.save(task);

        return savedVideo;
    }

    @Override
    @Async
    @Transactional
    public void processVideoAsync(Long videoId) {
        log.info("Starting ClipMind AI processing pipeline for video ID: {}", videoId);
        
        Video video = videoRepository.findById(videoId).orElse(null);
        if (video == null) {
            log.error("Video record not found for async processing. ID: {}", videoId);
            return;
        }

        List<VideoProcessing> tasks = videoProcessingRepository.findByVideoIdAndStatus(videoId, VideoStatus.QUEUED);
        VideoProcessing task = tasks.isEmpty() ? null : tasks.get(0);
        if (task == null) {
            task = VideoProcessing.builder()
                    .video(video)
                    .taskType("MEDIA_AND_AI_PROCESSING_PIPELINE")
                    .build();
        }

        try {
            // Stage 1: PROCESSING (FFmpeg Metadata & Thumbnail Extraction)
            video.setStatus(VideoStatus.PROCESSING);
            videoRepository.save(video);

            task.setStatus(VideoStatus.PROCESSING);
            task.setStartedAt(LocalDateTime.now());
            videoProcessingRepository.save(task);

            Path videoPath = Paths.get(video.getFilepath());

            // Validate video container
            if (!ffmpegService.isValidVideo(videoPath)) {
                throw new RuntimeException("Uploaded file does not contain a valid video stream.");
            }

            // Extract metadata
            VideoMetadata metadata = ffmpegService.extractMetadata(videoPath);
            video.setDuration(metadata.getDuration());
            video.setResolution(metadata.getResolution());
            video.setCodec(metadata.getCodec());

            // Generate thumbnail
            String thumbnailName = video.getId() + ".png";
            Path thumbnailFolder = fileStorageService.getFilePath("", "thumbnails").getParent();
            Path thumbnailPath = ffmpegService.generateThumbnail(videoPath, thumbnailFolder, thumbnailName);
            video.setThumbnailPath(thumbnailPath.toAbsolutePath().toString());
            videoRepository.save(video);

            // Stage 2: TRANSCRIBING (FFmpeg Audio Extraction -> Whisper Speech-to-Text)
            video.setStatus(VideoStatus.TRANSCRIBING);
            videoRepository.save(video);

            String audioName = video.getId() + ".wav";
            Path audioFolder = fileStorageService.getFilePath("", "audio").getParent();
            Path audioPath = ffmpegService.extractAudio(videoPath, audioFolder, audioName);

            Transcript transcript = whisperService.transcribeAudio(video, audioPath);

            // Stage 3: SUMMARIZING (NLP Multi-dimensional AI Summarization)
            video.setStatus(VideoStatus.SUMMARIZING);
            videoRepository.save(video);

            Summary summary = aiSummaryService.generateSummary(video, transcript);

            // Stage 4: ANALYZING (Key Moments, Keywords & Intelligence Report Generation)
            video.setStatus(VideoStatus.ANALYZING);
            videoRepository.save(video);

            keyMomentService.detectKeyMoments(video, transcript);
            keywordService.extractKeywords(video, transcript);
            reportService.generateReport(video);

            // Final Stage: COMPLETED
            video.setStatus(VideoStatus.COMPLETED);
            videoRepository.save(video);

            task.setStatus(VideoStatus.COMPLETED);
            task.setCompletedAt(LocalDateTime.now());
            videoProcessingRepository.save(task);

            log.info("Successfully completed full AI pipeline for video ID: {}", videoId);

        } catch (Exception e) {
            log.error("Failed to process video ID: {}", videoId, e);
            
            video.setStatus(VideoStatus.FAILED);
            videoRepository.save(video);

            task.setStatus(VideoStatus.FAILED);
            task.setErrorMessage(e.getMessage());
            task.setCompletedAt(LocalDateTime.now());
            videoProcessingRepository.save(task);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<Video> getAllUserVideos(Long userId) {
        return videoRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public Video getVideoById(Long id, Long userId) {
        return videoRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Video not found with ID: " + id + " for current user"));
    }

    @Override
    @Transactional
    public void deleteVideo(Long id, Long userId) {
        Video video = getVideoById(id, userId);

        // Cascade delete child entities
        keyMomentRepository.findByVideoIdOrderByStartTimeAsc(id).forEach(keyMomentRepository::delete);
        keywordRepository.findByVideoIdOrderByFrequencyDesc(id).forEach(keywordRepository::delete);
        reportRepository.findByVideoId(id).ifPresent(reportRepository::delete);
        summaryRepository.findByVideoId(id).ifPresent(summaryRepository::delete);
        transcriptRepository.findByVideoId(id).ifPresent(transcriptRepository::delete);
        videoProcessingRepository.findByVideoId(id).forEach(videoProcessingRepository::delete);

        fileStorageService.deleteFilePath(video.getFilepath());
        fileStorageService.deleteFilePath(video.getThumbnailPath());

        videoRepository.delete(video);
        log.info("Deleted video ID: {} and its physical files", id);
    }
}


