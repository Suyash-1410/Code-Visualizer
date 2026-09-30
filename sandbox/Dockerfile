# Stage 1: Build tracer fat jar
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /build

# Copy Maven poms, config, and tracer source
COPY pom.xml ./
COPY config/ ./config/
COPY services/tracer/pom.xml ./services/tracer/
COPY services/api/pom.xml ./services/api/

ARG CACHEBUST=1
COPY services/tracer/src ./services/tracer/src

# Build tracer fat jar
RUN mvn clean package -pl services/tracer -am -DskipTests

# Stage 2: Hardened runtime sandbox image (supports linux/amd64 and linux/arm64)
FROM eclipse-temurin:21-jdk

# Create non-root user and group (UID/GID 10001)
RUN groupadd -g 10001 javascope && \
    useradd -u 10001 -g javascope -s /bin/sh -m -d /home/javascope javascope

WORKDIR /app

# Copy tracer fat jar from builder stage
COPY --from=builder /build/services/tracer/target/tracer-1.0.0-SNAPSHOT.jar /app/tracer.jar

# Set ownership
RUN chown -R javascope:javascope /app /home/javascope

# Switch to non-root user
USER 10001:10001

# Hardened runtime entrypoint:
# -XX:-UsePerfData: Disables hsperfdata memory files in read-only / restricted environments
# -Djava.io.tmpdir=/tmp: Redirects temporary files and compilation outputs to writable tmpfs
ENTRYPOINT ["java", "-XX:-UsePerfData", "-Djava.io.tmpdir=/tmp", "-jar", "/app/tracer.jar"]
