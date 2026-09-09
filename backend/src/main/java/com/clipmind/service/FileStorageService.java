package com.clipmind.service;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.Path;

public interface FileStorageService {
    void init();
    String storeFile(MultipartFile file, String subDir);
    Path getFilePath(String fileName, String subDir);
    Resource loadFileAsResource(String fileName, String subDir);
    void deleteFile(String fileName, String subDir);
    void deleteFilePath(String fullPath);
}
