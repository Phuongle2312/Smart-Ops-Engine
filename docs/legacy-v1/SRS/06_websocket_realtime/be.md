# 06 — WebSocket Realtime — Backend

> **Trạng thái:** `[BE v2.0 🔜]` Chưa triển khai. Cần thêm `spring-websocket` dependency.

---

## Mục đích

Thay vì Client phải polling API mỗi N giây, Backend chủ động **push event** ngay khi có sự cố mới hoặc sự cố được giải quyết. Frontend nhận event và cập nhật UI tức thì mà không cần reload.

---

## Dependency cần thêm vào `pom.xml`

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

---

## Cấu hình WebSocket Broker

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");           // In-memory broker
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
            .setAllowedOriginPatterns("http://localhost:5173", "https://smartops.example.com")
            .withSockJS();  // Fallback cho browser không hỗ trợ WebSocket native
    }
}
```

- **Endpoint kết nối:** `ws://localhost:8080/ws`
- **Topic subscribe:** `/topic/incidents`
- **SockJS fallback:** Tự động dùng HTTP long-polling nếu WebSocket bị block

---

## Push Event từ Service

Inject `SimpMessagingTemplate` vào nơi cần push:

```java
@Service
@RequiredArgsConstructor
public class IncidentEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public void publishIncidentCreated(IncidentLog incident) {
        IncidentEvent event = new IncidentEvent("INCIDENT_CREATED", incident.getId(),
            incident.getNode().getId(), incident.getIncidentType(), incident.getStatus());
        messagingTemplate.convertAndSend("/topic/incidents", event);
    }

    public void publishIncidentResolved(IncidentLog incident) {
        IncidentEvent event = new IncidentEvent("INCIDENT_RESOLVED", incident.getId(),
            incident.getNode().getId(), incident.getIncidentType(), "RESOLVED");
        messagingTemplate.convertAndSend("/topic/incidents", event);
    }
}
```

**Gọi trong HealthCheckScheduler** sau khi `saveIncidentLog()`:
```java
incidentEventPublisher.publishIncidentCreated(savedIncident);
```

**Gọi trong NodeController** sau khi resolve:
```java
incidentEventPublisher.publishIncidentResolved(updatedIncident);
```

---

## Định dạng message WebSocket

**Event: Incident mới được tạo**
```json
{
  "eventType": "INCIDENT_CREATED",
  "incident": {
    "id": 15,
    "nodeId": 2,
    "nodeName": "prod-db-master",
    "incidentType": "DISK_CRITICAL",
    "issueDescription": "Disk usage CRITICAL: 92%",
    "status": "OPEN",
    "detectedAt": "2026-06-24T08:30:00"
  }
}
```

**Event: Incident đã được giải quyết**
```json
{
  "eventType": "INCIDENT_RESOLVED",
  "incident": {
    "id": 15,
    "nodeId": 2,
    "incidentType": "DISK_CRITICAL",
    "status": "RESOLVED",
    "resolvedAt": "2026-06-24T09:00:00"
  }
}
```

---

## Security cho WebSocket `[v2.0]`

```java
// Xác thực JWT khi handshake WebSocket
public class WebSocketAuthInterceptor implements HandshakeInterceptor {
    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ...) {
        String token = extractTokenFromQuery(request);  // ?token=eyJ...
        if (jwtService.isValid(token)) {
            attributes.put("user", jwtService.getUser(token));
            return true;
        }
        return false;  // Từ chối handshake nếu token invalid
    }
}
```

---

## Polling dự phòng (Backend side)

Không cần thêm logic phía Backend. Nếu Frontend WebSocket mất kết nối, Frontend tự động polling `GET /api/incidents` mỗi 5 phút (xem [FE WebSocket](fe.md)).

---

**Xem thêm:** [FE WebSocket](fe.md) · [BE Incident Management](../04_incident_management/be.md)
