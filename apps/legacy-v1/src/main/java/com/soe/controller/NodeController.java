package com.soe.controller;

import com.soe.entity.IncidentLog;
import com.soe.entity.Node;
import com.soe.repository.IncidentLogRepository;
import com.soe.repository.NodeRepository;
import com.soe.scheduler.HealthCheckScheduler;
import com.soe.util.AesEncryptionUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import com.soe.service.OutlookAlertService;

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
    private final HealthCheckScheduler healthCheckScheduler;
    private final OutlookAlertService outlookAlertService;

    // --- NODE CRUD ---

    @GetMapping("/nodes")
    public ResponseEntity<List<NodeResponse>> getAllNodes() {
        List<NodeResponse> response = nodeRepository.findAll().stream()
                .map(NodeResponse::from)
                .toList();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/nodes")
    public ResponseEntity<NodeResponse> addNode(@Valid @RequestBody NodeRequest request) {
        // Mã hóa mật khẩu bằng Utility đã có
        String encryptedPassword = AesEncryptionUtil.encrypt(request.password());

        Node node = Node.builder()
                .name(request.name())
                .host(request.host())
                .port(request.port() != null ? request.port() : 22)
                .username(request.username())
                .password(encryptedPassword) // Sử dụng trường password trong Node entity
                .description(request.description())
                .active(true)
                .build();

        Node saved = nodeRepository.save(node);
        log.info("[API] Đã tạo Node mới: {}", saved.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(NodeResponse.from(saved));
    }

    @GetMapping("/nodes/{id}")
    public ResponseEntity<NodeResponse> getNodeById(@PathVariable Long id) {
        return nodeRepository.findById(id)
                .map(NodeResponse::from)
                .map(ResponseEntity::ok)
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

    @DeleteMapping("/nodes/{id}")
    public ResponseEntity<Void> deleteNode(@PathVariable Long id) {
        if (nodeRepository.existsById(id)) {
            nodeRepository.deleteById(id);
            log.info("[API] Đã xóa Node ID: {}", id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    // --- OPERATIONS ---

    @PostMapping("/check-now")
    public ResponseEntity<Map<String, String>> triggerCheckNow() {
        log.info("[API] Kích hoạt kiểm tra thủ công qua @Async");
        
        // Gọi trực tiếp, Spring sẽ tự chạy ngầm nhờ @Async đã đặt ở Scheduler
        healthCheckScheduler.runDiskHealthCheck();

        return ResponseEntity.accepted().body(Map.of(
                "status", "TRIGGERED",
                "message", "Tiến trình kiểm tra đã bắt đầu. Kiểm tra Email hoặc Log để xem kết quả."
        ));
    }

    @GetMapping("/incidents")
    public ResponseEntity<List<IncidentLog>> getRecentIncidents() {
        return ResponseEntity.ok(incidentLogRepository.findTop50ByOrderByDetectedAtDesc());
    }

    @PutMapping("/incidents/{id}/resolve")
    public ResponseEntity<IncidentLog> resolveIncident(
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
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/test-email")
    public ResponseEntity<Map<String, String>> testEmail() {
        log.info("[API] Gửi email thử nghiệm...");
        try {
            outlookAlertService.sendIncidentReport(
                    "TEST-NODE",
                    "TEST_ALERT: Kiểm tra hệ thống email",
                    "Đây là email kiểm tra tính năng gửi cảnh báo của Smart Ops Engine."
            );
            return ResponseEntity.ok(Map.of(
                    "status", "SENT",
                    "message", "Email đã được gửi thành công tới " + "letriphuong23.12@gmail.com"
            ));
        } catch (Exception e) {
            log.error("[API] Gửi email thất bại: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "status", "FAILED",
                    "message", e.getMessage()
            ));
        }
    }

    // --- DTOs (Records) ---
    public record NodeRequest(String name, String host, Integer port, String username, String password, String description) {}
    
    public record NodeResponse(Long id, String name, String host, int port, String username, String description, boolean active) {
        public static NodeResponse from(Node node) {
        return new NodeResponse(
                node.getId(), 
                node.getName(), 
                node.getHost(),
                node.getPort(), 
                node.getUsername(), 
                node.getDescription(), 
                node.isActive() 
        );
        }
    }
}