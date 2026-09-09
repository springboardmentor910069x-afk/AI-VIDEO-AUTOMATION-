package com.clipmind.controller;

import com.clipmind.dto.ReportResponse;
import com.clipmind.security.UserPrincipal;
import com.clipmind.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/videos/{id}/report")
@CrossOrigin(origins = "*")
public class ReportController {

    @Autowired
    private ReportService reportService;

    @GetMapping
    public ResponseEntity<ReportResponse> getReport(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        boolean isAdmin = userPrincipal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        ReportResponse report = reportService.getReportByVideoId(id, userPrincipal.getId(), isAdmin);
        return ResponseEntity.ok(report);
    }

    @GetMapping("/download")
    public ResponseEntity<byte[]> downloadReport(
            @PathVariable("id") Long id,
            @RequestParam(value = "format", defaultValue = "markdown") String format,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        boolean isAdmin = userPrincipal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        ReportResponse report = reportService.getReportByVideoId(id, userPrincipal.getId(), isAdmin);
        byte[] bytes = report.getContent().getBytes();

        String filename = report.getVideoTitle().replaceAll("[^a-zA-Z0-9_-]", "_") + "_intelligence_report.md";

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_MARKDOWN)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(bytes);
    }
}