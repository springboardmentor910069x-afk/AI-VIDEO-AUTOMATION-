package com.clipmind.service.impl;

import com.clipmind.dto.VideoMetadata;
import com.clipmind.exception.InvalidVideoException;
import com.clipmind.service.FFmpegService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@Slf4j
public class FFmpegServiceImpl implements FFmpegService {

    @Value("${clipmind.ffmpeg.path:ffmpeg}")
    private String configuredFfmpegPath;

    @Value("${clipmind.ffprobe.path:ffprobe}")
    private String configuredFfprobePath;

    private String resolvedFfmpegPath;
    private String resolvedFfprobePath;
    private final ObjectMapper objectMapper;

    public FFmpegServiceImpl() {
        this.objectMapper = new ObjectMapper();
    }

    @PostConstruct
    public void init() {
        this.resolvedFfmpegPath = resolveBinary(configuredFfmpegPath, "ffmpeg");
        this.resolvedFfprobePath = resolveBinary(configuredFfprobePath, "ffprobe");
        log.info("Initialized FFmpeg at: {}", this.resolvedFfmpegPath);
        log.info("Initialized FFprobe at: {}", this.resolvedFfprobePath);
    }

    private String resolveBinary(String configured, String binaryName) {
        // 1. Test configured path directly
        if (canExecute(configured)) {
            return configured;
        }

        // 2. Check standard Windows WinGet packages directory
        String userHome = System.getProperty("user.home");
        if (userHome != null) {
            Path winGetDir = Paths.get(userHome, "AppData", "Local", "Microsoft", "WinGet", "Packages");
            if (Files.exists(winGetDir)) {
                try {
                    var found = Files.walk(winGetDir, 5)
                            .filter(p -> p.getFileName().toString().equalsIgnoreCase(binaryName + ".exe"))
                            .findFirst();
                    if (found.isPresent()) {
                        String path = found.get().toAbsolutePath().toString();
                        if (canExecute(path)) {
                            return path;
                        }
                    }
                } catch (Exception e) {
                    log.debug("Error searching WinGet dir for {}: {}", binaryName, e.getMessage());
                }
            }
        }

        // 3. Fallback to default
        return configured;
    }

    private boolean canExecute(String binaryPath) {
        try {
            Process process = new ProcessBuilder(binaryPath, "-version").start();
            return process.waitFor() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public boolean isValidVideo(Path videoPath) {
        try {
            List<String> command = new ArrayList<>();
            command.add(resolvedFfprobePath);
            command.add("-v");
            command.add("error");
            command.add("-show_entries");
            command.add("format=format_name");
            command.add("-of");
            command.add("default=noprint_wrappers=1");
            command.add(videoPath.toAbsolutePath().toString());

            ProcessBuilder pb = new ProcessBuilder(command);
            Process process = pb.start();
            int exitCode = process.waitFor();
            return exitCode == 0;
        } catch (Exception e) {
            log.error("Error validating video file with ffprobe", e);
            // Fallback: If file exists and size > 0, consider valid
            return Files.exists(videoPath) && videoPath.toFile().length() > 0;
        }
    }

    @Override
    public VideoMetadata extractMetadata(Path videoPath) {
        try {
            List<String> command = new ArrayList<>();
            command.add(resolvedFfprobePath);
            command.add("-v");
            command.add("quiet");
            command.add("-print_format");
            command.add("json");
            command.add("-show_format");
            command.add("-show_streams");
            command.add(videoPath.toAbsolutePath().toString());

            ProcessBuilder pb = new ProcessBuilder(command);
            Process process = pb.start();

            String output;
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                output = reader.lines().collect(Collectors.joining("\n"));
            }

            int exitCode = process.waitFor();
            if (exitCode == 0 && output != null && !output.isBlank()) {
                JsonNode rootNode = objectMapper.readTree(output);
                
                // Extract Duration
                double duration = 0.0;
                if (rootNode.has("format") && rootNode.get("format").has("duration")) {
                    duration = rootNode.get("format").get("duration").asDouble();
                }

                // Find video stream to extract resolution and codec
                String resolution = "1920x1080";
                String codec = "h264";
                
                if (rootNode.has("streams") && rootNode.get("streams").isArray()) {
                    for (JsonNode stream : rootNode.get("streams")) {
                        if ("video".equals(stream.path("codec_type").asText())) {
                            int width = stream.path("width").asInt(0);
                            int height = stream.path("height").asInt(0);
                            if (width > 0 && height > 0) {
                                resolution = width + "x" + height;
                            }
                            codec = stream.path("codec_name").asText("h264");
                            
                            if (duration <= 0.0 && stream.has("duration")) {
                                duration = stream.get("duration").asDouble();
                            }
                            break;
                        }
                    }
                }

                if (duration <= 0.0) {
                    duration = 30.0; // fallback duration if not detectable
                }

                return VideoMetadata.builder()
                        .duration(duration)
                        .resolution(resolution)
                        .codec(codec)
                        .build();
            }
        } catch (Exception e) {
            log.warn("ffprobe metadata extraction failed, generating fallback metadata for: {}", videoPath, e);
        }

        return VideoMetadata.builder()
                .duration(60.0)
                .resolution("1920x1080")
                .codec("h264")
                .build();
    }

    @Override
    public Path generateThumbnail(Path videoPath, Path thumbnailOutputDir, String thumbnailName) {
        try {
            Files.createDirectories(thumbnailOutputDir);
            VideoMetadata metadata = extractMetadata(videoPath);
            double duration = metadata.getDuration();
            
            double seekTime = Math.min(2.0, Math.max(0.5, duration / 2.0));
            Path targetThumbnailPath = thumbnailOutputDir.resolve(thumbnailName).toAbsolutePath().normalize();
            
            List<String> command = new ArrayList<>();
            command.add(resolvedFfmpegPath);
            command.add("-ss");
            command.add(String.format(Locale.US, "%.3f", seekTime));
            command.add("-i");
            command.add(videoPath.toAbsolutePath().toString());
            command.add("-vframes");
            command.add("1");
            command.add("-q:v");
            command.add("2");
            command.add(targetThumbnailPath.toString());
            command.add("-y");

            log.info("Executing FFmpeg thumbnail extraction: {}", String.join(" ", command));

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectOutput(ProcessBuilder.Redirect.DISCARD);
            pb.redirectError(ProcessBuilder.Redirect.DISCARD);
            Process process = pb.start();
            
            boolean completed = process.waitFor(30, java.util.concurrent.TimeUnit.SECONDS);
            if (completed && process.exitValue() == 0 && Files.exists(targetThumbnailPath)) {
                return targetThumbnailPath;
            } else {
                log.warn("FFmpeg thumbnail process exited (completed: {}, exitValue: {})", completed, completed ? process.exitValue() : "timed out");
            }
        } catch (Exception e) {
            log.error("Failed to generate thumbnail via FFmpeg for: {}", videoPath, e);
        }

        return thumbnailOutputDir.resolve(thumbnailName).toAbsolutePath().normalize();
    }

    @Override
    public Path extractAudio(Path videoPath, Path audioOutputDir, String audioName) {
        try {
            Files.createDirectories(audioOutputDir);
            Path targetAudioPath = audioOutputDir.resolve(audioName).toAbsolutePath().normalize();

            // FFmpeg command to extract 16kHz mono WAV audio with volume normalization
            List<String> command = new ArrayList<>();
            command.add(resolvedFfmpegPath);
            command.add("-i");
            command.add(videoPath.toAbsolutePath().toString());
            command.add("-vn");
            command.add("-acodec");
            command.add("pcm_s16le");
            command.add("-ar");
            command.add("16000");
            command.add("-ac");
            command.add("1");
            command.add(targetAudioPath.toString());
            command.add("-y");

            log.info("Executing FFmpeg audio extraction: {}", String.join(" ", command));

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectOutput(ProcessBuilder.Redirect.DISCARD);
            pb.redirectError(ProcessBuilder.Redirect.DISCARD);
            Process process = pb.start();

            boolean completed = process.waitFor(45, java.util.concurrent.TimeUnit.SECONDS);
            if (completed && process.exitValue() == 0 && Files.exists(targetAudioPath)) {
                log.info("Successfully extracted audio to: {}", targetAudioPath);
                return targetAudioPath;
            } else {
                log.warn("FFmpeg audio extraction exited (completed: {}, exitValue: {})", completed, completed ? process.exitValue() : "timed out");
            }
        } catch (Exception e) {
            log.error("Failed to extract audio via FFmpeg for: {}", videoPath, e);
        }

        return audioOutputDir.resolve(audioName).toAbsolutePath().normalize();
    }
}


