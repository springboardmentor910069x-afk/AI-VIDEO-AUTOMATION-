package com.clipmind.service.impl;

import com.clipmind.exception.StorageException;
import com.clipmind.service.FileStorageService;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.util.Objects;
import java.util.UUID;

@Service
public class FileStorageServiceImpl implements FileStorageService {

    private final Path fileStorageLocation;
    private final String uploadDirProp;

    public FileStorageServiceImpl(@Value("${clipmind.upload.dir:uploads}") String uploadDir) {
        this.uploadDirProp = uploadDir;
        this.fileStorageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    @Override
    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(this.fileStorageLocation.resolve("videos"));
            Files.createDirectories(this.fileStorageLocation.resolve("processed"));
            Files.createDirectories(this.fileStorageLocation.resolve("thumbnails"));
            Files.createDirectories(this.fileStorageLocation.resolve("temp"));
        } catch (Exception ex) {
            throw new StorageException("Could not create the directory where the uploaded files will be stored.", ex);
        }
    }

    @Override
    public String storeFile(MultipartFile file, String subDir) {
        // Normalize file name
        String originalFilename = StringUtils.cleanPath(Objects.requireNonNull(file.getOriginalFilename()));
        String extension = "";
        
        int idx = originalFilename.lastIndexOf('.');
        if (idx > 0) {
            extension = originalFilename.substring(idx);
        }
        
        // Generate a unique filename using UUID to prevent collisions
        String uniqueFileName = UUID.randomUUID().toString() + extension;

        try {
            // Check if the filename contains invalid characters
            if (uniqueFileName.contains("..")) {
                throw new StorageException("Sorry! Filename contains invalid path sequence " + uniqueFileName);
            }

            // Copy file to the target location (Replacing existing file with the same name)
            Path targetLocation = this.fileStorageLocation.resolve(subDir).resolve(uniqueFileName);
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, targetLocation, StandardCopyOption.REPLACE_EXISTING);
            }

            return uniqueFileName;
        } catch (IOException ex) {
            throw new StorageException("Failed to store file " + uniqueFileName + ". Please try again!", ex);
        }
    }

    @Override
    public Path getFilePath(String fileName, String subDir) {
        return this.fileStorageLocation.resolve(subDir).resolve(fileName).normalize();
    }

    @Override
    public Resource loadFileAsResource(String fileName, String subDir) {
        try {
            Path filePath = getFilePath(fileName, subDir);
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new StorageException("File not found or not readable: " + fileName);
            }
        } catch (MalformedURLException ex) {
            throw new StorageException("File path is invalid: " + fileName, ex);
        }
    }

    @Override
    public void deleteFile(String fileName, String subDir) {
        try {
            Path filePath = getFilePath(fileName, subDir);
            Files.deleteIfExists(filePath);
        } catch (IOException ex) {
            throw new StorageException("Could not delete file " + fileName, ex);
        }
    }

    @Override
    public void deleteFilePath(String fullPath) {
        if (fullPath == null || fullPath.isBlank()) {
            return;
        }
        try {
            Path path = Paths.get(fullPath).toAbsolutePath().normalize();
            Files.deleteIfExists(path);
        } catch (IOException ex) {
            // Log warning but don't crash core transactions
            System.err.println("Warning: Failed to delete path: " + fullPath + " (" + ex.getMessage() + ")");
        }
    }
}
