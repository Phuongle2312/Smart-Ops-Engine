package com.soe.controller;

import com.soe.ai.AiDiagnosisClient;
import com.soe.ai.AiProperties;
import com.soe.ai.AiServiceException;
import com.soe.ai.DiagnosisService;
import com.soe.repository.IncidentLogRepository;
import com.soe.repository.NodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

/** Chẩn đoán lỗi RAM/CPU/GPU từ ảnh — xem docs/ai-diagnosis/SRS.md. */
@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DiagnosisController {

    private static final long MAX_BYTES = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of("image/png", "image/jpeg", "image/webp");

    private final DiagnosisService diagnosisService;
    private final AiDiagnosisClient aiClient;
    private final AiProperties aiProperties;
    private final NodeRepository nodeRepository;
    private final IncidentLogRepository incidentLogRepository;

    /**
     * Nhận ảnh, trả 202 ngay; kết quả xuất hiện ở /api/incidents và email người phụ trách khi AI xong.
     */
    @PostMapping(value = "/diagnose", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, String>> diagnose(
            @RequestParam("file") MultipartFile file,
            @RequestParam("nodeId") Long nodeId,
            @RequestParam(value = "note", required = false) String note) throws IOException {
        if (!aiProperties.isEnabled()) {
            return error(HttpStatus.SERVICE_UNAVAILABLE, "Chức năng chẩn đoán ảnh đang tắt");
        }
        if (file.isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, "Ảnh rỗng");
        }
        if (file.getSize() > MAX_BYTES) {
            return error(HttpStatus.BAD_REQUEST, "Ảnh vượt quá 10 MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            return error(HttpStatus.BAD_REQUEST, "Chỉ nhận ảnh PNG, JPEG hoặc WEBP");
        }
        if (!nodeRepository.existsById(nodeId)) {
            return error(HttpStatus.NOT_FOUND, "Không tìm thấy node " + nodeId);
        }

        diagnosisService.submit(nodeId, file.getBytes(), file.getOriginalFilename(), contentType, note);
        log.info("[API] Đã nhận ảnh chẩn đoán cho node {} ({} byte)", nodeId, file.getSize());
        return ResponseEntity.accepted().body(Map.of(
                "status", "PROCESSING",
                "message", "Đang phân tích. Kết quả sẽ có ở danh sách sự cố và email người phụ trách."));
    }

    public record AiFeedbackRequest(boolean correct, String correctCode, String comment) {}

    /** Người xử lý xác nhận chẩn đoán AI đúng/sai — dữ liệu này dùng để cải thiện nhận diện. */
    @PostMapping("/incidents/{id}/ai-feedback")
    public ResponseEntity<Map<String, String>> feedback(@PathVariable Long id, @RequestBody AiFeedbackRequest body) {
        var incident = incidentLogRepository.findById(id).orElse(null);
        if (incident == null) {
            return error(HttpStatus.NOT_FOUND, "Không tìm thấy sự cố " + id);
        }
        if (incident.getDiagnosisId() == null) {
            return error(HttpStatus.CONFLICT, "Sự cố này không đến từ chẩn đoán ảnh");
        }
        try {
            aiClient.sendFeedback(incident.getDiagnosisId(), body.correct(), body.correctCode(), body.comment());
        } catch (AiServiceException e) {
            HttpStatus status = e.isClientError() ? HttpStatus.BAD_REQUEST : HttpStatus.BAD_GATEWAY;
            return error(status, e.getMessage());
        }
        return ResponseEntity.ok(Map.of("status", "recorded"));
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
