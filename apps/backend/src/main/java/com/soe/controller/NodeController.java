package com.soe.controller;

import com.soe.entity.IncidentLog;
import com.soe.entity.Node;
import com.soe.entity.NodeMetric;
import com.soe.repository.IncidentLogRepository;
import com.soe.repository.NodeMetricRepository;
import com.soe.repository.NodeRepository;
import com.soe.scheduler.HealthCheckScheduler;
import com.soe.service.NodeMetricsService;
import com.soe.service.NodeMetricsService.NodeMetricsSnapshot;
import com.soe.service.OutlookAlertService;
import com.soe.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * NodeController — REST API chuyên nghiệp cho Smart Ops Engine.
 */
@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class NodeController {

    private final NodeRepository nodeRepository;
    private final IncidentLogRepository incidentLogRepository;
    private final NodeMetricRepository nodeMetricRepository;
    private final NodeMetricsService nodeMetricsService;
    private final HealthCheckScheduler healthCheckScheduler;
    private final OutlookAlertService outlookAlertService;
    private final com.soe.repository.NodeOwnerRepository nodeOwnerRepository;
    private final SystemConfigService systemConfigService;

    // --- NODE CRUD ---

    @GetMapping("/nodes")
    public ResponseEntity<List<NodeResponse>> getAllNodes() {
        List<NodeResponse> response = nodeRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/nodes")
    public ResponseEntity<?> addNode(@RequestBody NodeRequest request) {
        String invalid = validateNewNode(request);
        if (invalid != null) {
            return ResponseEntity.badRequest().body(Map.of("error", invalid));
        }
        if (nodeRepository.findByHost(request.host().trim()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Host '" + request.host().trim() + "' đã được đăng ký cho node khác"));
        }
        Node node = Node.builder()
                .name(request.name().trim())
                .host(request.host().trim())
                .port(request.port() != null ? request.port() : 22)
                .username(request.username().trim())
                .password(request.password()) // CryptoConverter tự mã hóa khi persist — không encrypt thủ công (tránh double-encrypt)
                .description(request.description())
                .active(true)
                .build();

        Node saved = nodeRepository.save(node);
        log.info("[API] Đã tạo Node mới: {}", saved.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @GetMapping("/nodes/{id}")
    public ResponseEntity<NodeResponse> getNodeById(@PathVariable Long id) {
        return nodeRepository.findById(id)
                .map(this::toResponse)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/nodes/{id}")
    public ResponseEntity<?> updateNode(@PathVariable Long id, @RequestBody NodeRequest request) {
        if (request.port() != null && !validPort(request.port())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Port phải trong khoảng 1-65535"));
        }
        if (request.host() != null) {
            if (request.host().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Host không được để trống"));
            }
            var other = nodeRepository.findByHost(request.host().trim());
            if (other.isPresent() && !other.get().getId().equals(id)) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "Host '" + request.host().trim() + "' đã được đăng ký cho node khác"));
            }
        }
        return nodeRepository.findById(id)
                .map(node -> {
                    if (request.name() != null && !request.name().isBlank()) node.setName(request.name().trim());
                    if (request.host() != null) node.setHost(request.host().trim());
                    if (request.port() != null) node.setPort(request.port());
                    if (request.username() != null) node.setUsername(request.username());
                    if (request.description() != null) node.setDescription(request.description());
                    // Chỉ đổi mật khẩu khi client gửi giá trị mới
                    if (request.password() != null && !request.password().isBlank()) node.setPassword(request.password());
                    return ResponseEntity.ok((Object) toResponse(nodeRepository.save(node)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/nodes/{id}/toggle-active")
    public ResponseEntity<?> toggleActiveNode(@PathVariable Long id) {
        return nodeRepository.findById(id)
                .map(node -> {
                    node.setActive(!node.isActive());
                    Node updated = nodeRepository.save(node);
                    log.info("[API] Đã toggle trạng thái active Node '{}' thành: {}", updated.getName(), updated.isActive());
                    return ResponseEntity.ok(Map.of(
                            "id", updated.getId(),
                            "name", updated.getName(),
                            "active", updated.isActive(),
                            "message", "Trạng thái giám sát Node đã được thay đổi."
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @Transactional
    @DeleteMapping("/nodes/{id}")
    public ResponseEntity<Void> deleteNode(@PathVariable Long id) {
        if (nodeRepository.existsById(id)) {
            // Người phụ trách, sự cố và lịch sử metrics tham chiếu node qua FK — xóa trước để không vướng ràng buộc
            nodeOwnerRepository.deleteByNodeId(id);
            incidentLogRepository.deleteByNodeId(id);
            nodeMetricRepository.deleteByNodeId(id);
            nodeRepository.deleteById(id);
            log.info("[API] Đã xóa Node ID: {}", id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    // --- OPERATIONS ---

    @PostMapping("/check-now")
    public ResponseEntity<Map<String, String>> triggerCheckNow() {
        log.info("[API] Kích hoạt kiểm tra thủ công");
        healthCheckScheduler.runDiskHealthCheck();
        return ResponseEntity.accepted().body(Map.of(
                "status", "TRIGGERED",
                "message", "Tiến trình kiểm tra đã bắt đầu. Kiểm tra Email hoặc Log để xem kết quả."
        ));
    }

    @PostMapping("/nodes/{id}/check-now")
    public ResponseEntity<?> checkNodeNow(@PathVariable Long id) {
        return nodeRepository.findById(id)
                .map(node -> {
                    try {
                        NodeMetricsSnapshot snap = nodeMetricsService.collectAndSave(node);
                        return ResponseEntity.ok(Map.of(
                                "nodeId", id,
                                "nodeName", node.getName(),
                                "diskPercent", snap.diskPercent(),
                                "cpuPercent", snap.cpuPercent(),
                                "memoryPercent", snap.memoryPercent()
                        ));
                    } catch (Exception e) {
                        log.error("[API] check-now failed for node {}: {}", id, e.getMessage());
                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                .body(Map.of("error", e.getMessage()));
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/nodes/{id}/metrics")
    public ResponseEntity<List<MetricPoint>> getNodeMetrics(
            @PathVariable Long id,
            @RequestParam(defaultValue = "24h") String range) {
        if (!nodeRepository.existsById(id)) return ResponseEntity.notFound().build();
        LocalDateTime since = LocalDateTime.now().minusHours(switch (range) {
            case "7d" -> 24L * 7;
            case "30d" -> 24L * 30;
            default -> 24L;
        });
        List<MetricPoint> points = nodeMetricRepository
                .findByNodeIdAndRecordedAtAfterOrderByRecordedAtAsc(id, since).stream()
                .map(MetricPoint::from)
                .toList();
        return ResponseEntity.ok(points);
    }

    @GetMapping("/incidents")
    public ResponseEntity<List<IncidentResponse>> getRecentIncidents() {
        return ResponseEntity.ok(incidentLogRepository.findTop50ByOrderByDetectedAtDesc().stream()
                .map(IncidentResponse::from)
                .toList());
    }

    @PutMapping("/incidents/{id}/acknowledge")
    public ResponseEntity<IncidentResponse> acknowledgeIncident(@PathVariable Long id) {
        return incidentLogRepository.findById(id)
                .map(incident -> {
                    if ("OPEN".equals(incident.getStatus())) incident.setStatus("ACKNOWLEDGED");
                    return ResponseEntity.ok(IncidentResponse.from(incidentLogRepository.save(incident)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/incidents/{id}/resolve")
    public ResponseEntity<IncidentResponse> resolveIncident(
            @PathVariable Long id, 
            @RequestBody(required = false) Map<String, String> body) {
        return incidentLogRepository.findById(id)
                .map(incident -> {
                    incident.setStatus("RESOLVED");
                    incident.setResolvedAt(LocalDateTime.now());
                    if (body != null && body.containsKey("resolutionAction")) {
                        incident.setResolutionAction(body.get("resolutionAction"));
                    } else if (incident.getResolutionAction() == null || incident.getResolutionAction().isEmpty()) {
                        incident.setResolutionAction("Sự cố đã được xác nhận và giải quyết.");
                    }
                    IncidentLog updated = incidentLogRepository.save(incident);
                    log.info("[API] Đã giải quyết sự cố ID: {}", id);
                    return ResponseEntity.ok(IncidentResponse.from(updated));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/test-email")
    public ResponseEntity<Map<String, String>> testEmail() {
        log.info("[API] Gửi email thử nghiệm...");
        try {
            String recipient = systemConfigService.getCurrentConfig().getAlertRecipientEmail();
            outlookAlertService.sendIncidentReport(
                    "TEST-NODE",
                    "TEST_ALERT: Kiểm tra hệ thống email",
                    "Đây là email kiểm tra tính năng gửi cảnh báo của Smart Ops Engine."
            );
            return ResponseEntity.ok(Map.of(
                    "status", "SENT",
                    "message", "Email đã được gửi thành công tới " + recipient
            ));
        } catch (Exception e) {
            log.error("[API] Gửi email thất bại: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "status", "FAILED",
                    "message", e.getMessage()
            ));
        }
    }

    private static boolean validPort(int port) {
        return port >= 1 && port <= 65535;
    }

    /** @return thông báo lỗi, hoặc null nếu hợp lệ. */
    private static String validateNewNode(NodeRequest r) {
        if (r.name() == null || r.name().isBlank()) return "Tên node không được để trống";
        if (r.host() == null || r.host().isBlank()) return "Host không được để trống";
        if (r.username() == null || r.username().isBlank()) return "Username không được để trống";
        if (r.port() != null && !validPort(r.port())) return "Port phải trong khoảng 1-65535";
        return null;
    }

    // --- DTOs (Records) ---
    public record NodeRequest(String name, String host, Integer port, String username, String password, String description) {}
    
    /** Chỉ số mới nhất của node (null nếu chưa có lần đo nào; -1 = đo lỗi). */
    private NodeResponse toResponse(Node node) {
        NodeMetric m = nodeMetricRepository.findFirstByNodeIdOrderByRecordedAtDesc(node.getId()).orElse(null);
        return NodeResponse.from(node, m);
    }

    public record NodeResponse(Long id, String name, String host, int port, String username, String description,
                               boolean active, Integer cpu, Integer disk, Integer ram, LocalDateTime lastCheckedAt) {
        public static NodeResponse from(Node node, NodeMetric m) {
            return new NodeResponse(
                    node.getId(), node.getName(), node.getHost(), node.getPort(),
                    node.getUsername(), node.getDescription(), node.isActive(),
                    m == null ? null : m.getCpuUsagePercent(),
                    m == null ? null : m.getDiskUsagePercent(),
                    m == null ? null : m.getMemoryUsagePercent(),
                    m == null ? null : m.getRecordedAt());
        }
    }

    public record MetricPoint(LocalDateTime timestamp, Integer cpu, Integer disk, Integer ram) {
        public static MetricPoint from(NodeMetric m) {
            return new MetricPoint(m.getRecordedAt(), m.getCpuUsagePercent(), m.getDiskUsagePercent(), m.getMemoryUsagePercent());
        }
    }

    public record IncidentResponse(Long id, NodeRef node, String incidentType, String issueDescription,
                                   String resolutionAction, String status, LocalDateTime detectedAt, LocalDateTime resolvedAt,
                                   String diagnosisId, Double aiConfidence) {
        public record NodeRef(Long id, String name) {}

        public static IncidentResponse from(IncidentLog i) {
            return new IncidentResponse(i.getId(), new NodeRef(i.getNode().getId(), i.getNode().getName()),
                    i.getIncidentType(), i.getIssueDescription(), i.getResolutionAction(),
                    i.getStatus(), i.getDetectedAt(), i.getResolvedAt(),
                    i.getDiagnosisId(), i.getAiConfidence());
        }
    }
}
