# 1. Build Stage
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# 2. Runtime Stage with FFmpeg
FROM eclipse-temurin:17-jre
WORKDIR /app

# Install FFmpeg & curl
RUN apt-get update && apt-get install -y ffmpeg curl && rm -rf /var/lib/apt/lists/*

# Copy built artifact
COPY --from=build /app/target/clipmind-backend-0.0.1-SNAPSHOT.jar app.jar

# Create upload directory
RUN mkdir -p uploads/videos uploads/thumbnails uploads/audio

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]