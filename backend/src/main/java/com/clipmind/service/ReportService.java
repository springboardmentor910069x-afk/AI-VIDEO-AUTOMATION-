package com.clipmind.service;

import com.clipmind.dto.ReportResponse;
import com.clipmind.model.Report;
import com.clipmind.model.Video;

public interface ReportService {
    Report generateReport(Video video);
    ReportResponse getReportByVideoId(Long videoId, Long userId, boolean isAdmin);
}