package com.clipmind.controller;

import com.clipmind.dto.VideoResponse;
import com.clipmind.model.Video;
import com.clipmind.security.UserPrincipal;
import com.clipmind.service.FileStorageService;
import com.clipmind.service.VideoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/videos")
@CrossOrigin(origins = "*")
public class VideoController {

    @Autowired
    private VideoService videoService;

    @Autowired
    private FileStorageService fileStorageService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<VideoResponse> uploadVideo(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam(value = "description", required = false) String description,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        Video video = videoService.uploadVideo(file, title, description, userPrincipal.getUser());
        
        // Trigger background processing asynchronously
        videoService.processVideoAsync(video.getId());

        return ResponseEntity.ok(mapToResponse(video));
    }

    @GetMapping
    public ResponseEntity<List<VideoResponse>> getAllUserVideos(@AuthenticationPrincipal UserPrincipal userPrincipal) {
        List<Video> videos = videoService.getAllUserVideos(userPrincipal.getId());
        List<VideoResponse> response = videos.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<VideoResponse> getVideoById(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Video video = videoService.getVideoById(id, userPrincipal.getId());
        return ResponseEntity.ok(mapToResponse(video));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteVideo(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        videoService.deleteVideo(id, userPrincipal.getId());
        return ResponseEntity.ok("Video deleted successfully");
    }

    @GetMapping("/{id}/thumbnail")
    public ResponseEntity<Resource> getVideoThumbnail(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Video video = videoService.getVideoById(id, userPrincipal.getId());
        
        if (video.getThumbnailPath() == null) {
            return ResponseEntity.notFound().build();
        }

        // Extract thumbnail filename from absolute path
        Path path = Paths.get(video.getThumbnailPath());
        String filename = path.getFileName().toString();

        Resource resource = fileStorageService.loadFileAsResource(filename, "thumbnails");
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(resource);
    }

    @GetMapping("/{id}/stream")
    public ResponseEntity<Resource> streamVideo(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Video video = videoService.getVideoById(id, userPrincipal.getId());
        
        Resource resource = fileStorageService.loadFileAsResource(video.getFilename(), "videos");
        
        String contentType = video.getContentType();
        if (contentType == null || contentType.isBlank()) {
            contentType = "video/mp4";
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + video.getFilename() + "\"")
                .body(resource);
    }

    private VideoResponse mapToResponse(Video video) {
        return VideoResponse.builder()
                .id(video.getId())
                .title(video.getTitle())
                .description(video.getDescription())
                .filename(video.getFilename())
                .fileSize(video.getFileSize())
                .contentType(video.getContentType())
                .duration(video.getDuration())
                .resolution(video.getResolution())
                .codec(video.getCodec())
                .status(video.getStatus().name())
                .createdAt(video.getCreatedAt())
                .updatedAt(video.getUpdatedAt())
                .build();
    }
}
