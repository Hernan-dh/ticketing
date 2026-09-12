FROM gradle:8.14.3-jdk17 AS build
WORKDIR /app
COPY . .
RUN gradle bootJar --no-daemon
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
USER 10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
