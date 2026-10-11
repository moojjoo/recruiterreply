FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project file first to optimize restore layer caching.
COPY RecruiterReply.csproj ./
RUN dotnet restore RecruiterReply.csproj

COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Development
COPY --from=build /app/publish .
# Initialize Data Protection key storage before dropping root privileges.
# Docker copies this ownership into an empty named volume on first mount.
RUN mkdir -p /app/keys && chown 1654:1654 /app/keys && chmod 700 /app/keys
EXPOSE 8080
USER app
ENTRYPOINT ["dotnet", "RecruiterReply.dll"]