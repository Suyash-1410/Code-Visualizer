# Stage 1: Build API artifact
FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /build

COPY pom.xml ./
COPY services/tracer/pom.xml ./services/tracer/
COPY services/api/pom.xml ./services/api/
COPY services/tracer/src ./services/tracer/src
COPY services/api/src ./services/api/src
COPY config ./config

RUN mvn clean package -DskipTests

# Stage 2: Runtime image
FROM eclipse-temurin:21-jre
WORKDIR /app

# Install docker CLI so container can communicate with the mounted Docker daemon in local dev
RUN apt-get update && \
    apt-get install -y --no-install-recommends docker.io && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/services/api/target/api-1.0.0-SNAPSHOT.jar /app/api.jar
COPY config /app/config

ENV JAVA_TOOL_OPTIONS="-Xmx256m"
ENV JAVASCOPE_CONFIG_DIR="/app/config"

EXPOSE 8080

ENTRYPOINT ["java", "-Xmx256m", "-jar", "/app/api.jar"]
