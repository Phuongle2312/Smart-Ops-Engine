package com.soe.ai;

import com.soe.entity.IncidentLog;
import com.soe.entity.Node;
import com.soe.entity.NodeOwner;
import com.soe.repository.IncidentLogRepository;
import com.soe.repository.NodeOwnerRepository;
import com.soe.repository.NodeRepository;
import com.soe.service.OutlookAlertService;
import com.soe.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * Điều phối: ảnh → ai-service → IncidentLog → email người phụ trách.
 * Chỉ gợi ý và thông báo — không thực thi lệnh sửa lỗi.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DiagnosisService {

    static final String TYPE_UNKNOWN = "AI_UNKNOWN";
    static final String TYPE_FAILED = "AI_DIAGNOSIS_FAILED";
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final AiDiagnosisClient client;
    private final NodeRepository nodeRepository;
    private final NodeOwnerRepository nodeOwnerRepository;
    private final IncidentLogRepository incidentLogRepository;
    private final OutlookAlertService alertService;
    private final SystemConfigService systemConfigService;

    /** Chạy nền: vision LLM trên CPU có thể mất cả phút nên không chặn request của người dùng. */
    @Async
    public void submit(Long nodeId, byte[] image, String filename, String contentType, String note) {
        try {
            process(nodeId, image, filename, contentType, note);
        } catch (Exception e) {
            // @Async không có caller nhận exception — ghi log để không mất dấu
            log.error("[AI] Xử lý ảnh cho node {} thất bại: {}", nodeId, e.getMessage(), e);
        }
    }

    /** Đồng bộ — tách riêng để test. Trả incident đã tạo, hoặc empty nếu ảnh bị ai-service từ chối (4xx). */
    public Optional<IncidentLog> process(Long nodeId, byte[] image, String filename, String contentType, String note) {
        Node node = nodeRepository.findById(nodeId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy node " + nodeId));

        DiagnosisResult result;
        try {
            result = client.diagnose(image, filename, String.valueOf(nodeId), note);
        } catch (AiServiceException e) {
            if (e.isClientError()) {
                log.warn("[AI] Ảnh bị từ chối cho node '{}': {}", node.getName(), e.getMessage());
                return Optional.empty();
            }
            return Optional.of(handleUnavailable(node, e, image, filename, contentType));
        }

        IncidentLog incident = incidentLogRepository.save(IncidentLog.builder()
                .node(node)
                .incidentType(result.isUnknown() ? TYPE_UNKNOWN : result.errorCode())
                .issueDescription(describe(result))
                .resolutionAction(result.runbook() != null ? "Gợi ý xử lý: " + result.runbook().title()
                        + " (người phụ trách thực hiện tại máy)" : null)
                .status("OPEN")
                .detectedAt(LocalDateTime.now())
                .diagnosisId(result.diagnosisId())
                .aiConfidence(result.confidence())
                .build());

        // Không nhận diện được → báo quản trị viên để gắn nhãn; còn lại → người phụ trách node
        List<String> to = result.isUnknown() ? adminRecipients() : ownerRecipients(node);
        String timeStr = LocalDateTime.now().format(TIME);
        send(to, DiagnosisEmailTemplate.subject(node.getName(), result),
                DiagnosisEmailTemplate.build(node.getName(), result, timeStr, image != null && image.length > 0),
                image, contentType, filename);
        return Optional.of(incident);
    }

    private IncidentLog handleUnavailable(Node node, AiServiceException e, byte[] image, String filename, String contentType) {
        log.error("[AI] ai-service không khả dụng cho node '{}': {}", node.getName(), e.getMessage());
        IncidentLog incident = incidentLogRepository.save(IncidentLog.builder()
                .node(node)
                .incidentType(TYPE_FAILED)
                .issueDescription("Không phân tích được ảnh lỗi do dịch vụ AI không khả dụng: " + e.getMessage())
                .resolutionAction("Quản trị viên xem ảnh đính kèm email và xử lý thủ công")
                .status("OPEN")
                .detectedAt(LocalDateTime.now())
                .build());
        send(adminRecipients(), DiagnosisEmailTemplate.subjectFailure(node.getName()),
                DiagnosisEmailTemplate.buildFailure(node.getName(), e.getMessage(), LocalDateTime.now().format(TIME),
                        image != null && image.length > 0),
                image, contentType, filename);
        return incident;
    }

    /** Người phụ trách cấp thấp nhất (escalationOrder nhỏ nhất); không có ai → quản trị viên. */
    List<String> ownerRecipients(Node node) {
        List<NodeOwner> owners = nodeOwnerRepository.findByNodeIdOrderByEscalationOrderAsc(node.getId());
        if (owners.isEmpty()) {
            log.warn("[AI] Node '{}' chưa có người phụ trách — gửi cho quản trị viên", node.getName());
            return adminRecipients();
        }
        int first = owners.get(0).getEscalationOrder();
        return owners.stream().filter(o -> o.getEscalationOrder() == first).map(NodeOwner::getEmail).toList();
    }

    private List<String> adminRecipients() {
        String admin = systemConfigService.getCurrentConfig().getAlertRecipientEmail();
        return admin == null || admin.isBlank() ? List.of() : List.of(admin);
    }

    private void send(List<String> to, String subject, String html, byte[] image, String contentType, String filename) {
        if (to.isEmpty()) {
            log.error("[AI] Không có người nhận email — chưa cấu hình email quản trị. Incident vẫn được lưu.");
            return;
        }
        try {
            alertService.sendDiagnosisReport(to, subject, html, image, contentType, filename);
        } catch (Exception e) {
            // Incident đã lưu — lỗi SMTP không được làm mất kết quả chẩn đoán
            log.error("[AI] Gửi email chẩn đoán thất bại: {}", e.getMessage());
        }
    }

    private static String describe(DiagnosisResult r) {
        if (r.isUnknown()) {
            return "AI chưa nhận diện được lỗi từ ảnh (độ tin cậy " + pct(r) + "). Cần gắn nhãn thủ công.";
        }
        String evidence = r.evidence() == null || r.evidence().isEmpty() ? "" : " Bằng chứng: " + String.join("; ", r.evidence());
        return "Chẩn đoán từ ảnh: " + r.errorCode() + " (" + r.resource() + ", " + r.severity() + "), độ tin cậy "
                + pct(r) + (r.needsReview() ? " — cần xác nhận." : ".") + evidence;
    }

    private static String pct(DiagnosisResult r) {
        return Math.round(r.confidence() * 100) + "%";
    }
}
