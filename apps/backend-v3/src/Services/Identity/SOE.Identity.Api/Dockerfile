# syntax=docker/dockerfile:1
# Build context: thư mục backend-v3/
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

COPY Directory.Build.props Directory.Packages.props ./
COPY src/BuildingBlocks/ src/BuildingBlocks/
COPY src/Services/Identity/ src/Services/Identity/

RUN dotnet restore "src/Services/Identity/SOE.Identity.Api/SOE.Identity.Api.csproj"
RUN dotnet publish "src/Services/Identity/SOE.Identity.Api/SOE.Identity.Api.csproj" \
    -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final
RUN apk add --no-cache icu-libs
RUN adduser -D -u 10001 soe
WORKDIR /app
COPY --from=build /app/publish .
USER 10001

ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_EnableDiagnostics=0
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8080/health/live || exit 1

ENTRYPOINT ["dotnet", "SOE.Identity.Api.dll"]
