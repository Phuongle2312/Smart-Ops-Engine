package com.soe.scheduler;

import com.soe.entity.IncidentLog;
import com.soe.entity.Node;
import com.soe.entity.SystemConfig;
import com.soe.repository.IncidentLogRepository;
import com.soe.repository.NodeRepository;
import com.soe.service.NodeMetricsService;
import com.soe.service.NodeMetricsService.NodeMetricsSnapshot;
import com.soe.service.OutlookAlertService;
import com.soe.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class HealthCheckScheduler {

    private final NodeRepository nodeRepository;
    private final IncidentLogRepository incidentLogRepository;
    private final OutlookAlertService outlookAlertService;
    private final NodeMetricsService nodeMetricsService;
    private final SystemConfigService systemConfigService;

    // LƯU Ý: @Scheduled đọc property này 1 LẦN lúc Spring khởi động (giới hạn của annotation-based
    // scheduling). Trường "Chu kỳ quét" trên trang Cấu hình hệ thống được lưu vào DB để tham khảo/dùng
    // cho v2.0, nhưng đổi giá trị này qua UI hiện tại CHƯA áp dụng ngay — vẫn cần restart backend.
    @Scheduled(fixedDelayString = "${smartops.scheduler.disk-check-interval-ms:300000}",
               initialDelay = 60_000)
    public void runDiskHealthCheck() {
        log.info("[SCHEDULER] === Starting health check cycle ===");
        List<Node> activeNodes = nodeRepository.findByActiveTrue();
        log.info("[SCHEDULER] Found {} active node(s) to check", activeNodes.size());

        for (Node node : activeNodes) {
            checkAllMetrics(node);
        }

        log.info("[SCHEDULER] === Health check cycle completed ===");
    }

    @Scheduled(cron = "${smartops.scheduler.daily-report-cron:0 0 8 * * MON-FRI}")
    public void runDailyReport() {
        log.info("[SCHEDULER] Running daily morning health report...");
        List<Node> activeNodes = nodeRepository.findByActiveTrue();
        long openIncidentsCount = incidentLogRepository.findAll().stream()
                .filter(inc -> "OPEN".equalsIgnoreCase(inc.getStatus()))
                .count();
        try {
            outlookAlertService.sendDailySummaryReport(activeNodes.size(), openIncidentsCount);
        } catch (Exception e) {
            log.error("[SCHEDULER] Failed to send daily summary report: {}", e.getMessage(), e);
        }
    }

    private void checkAllMetrics(Node node) {
        try {
            SystemConfig config = systemConfigService.getCurrentConfig();
            int diskWarning = config.getDiskWarningThreshold();
            int diskCritical = config.getDiskCriticalThreshold();
            int cpuCritical = config.getCpuCriticalThreshold();
            int memoryCritical = config.getMemoryCriticalThreshold();

            NodeMetricsSnapshot snap = nodeMetricsService.collectAndSave(node);

            // --- Disk ---
            if (snap.diskPercent() >= diskCritical) {
                String issue = String.format("Disk usage CRITICAL: %d%% (ngưỡng: %d%%)", snap.diskPercent(), diskCritical);
                String resolution = "Cần xem xét ngay: dọn log cũ, xóa temp files, hoặc mở rộng dung lượng.";
                outlookAlertService.sendMetricsAlert(node.getName(), snap, "DISK_CRITICAL", issue, resolution);
                saveIncidentLog(node, "DISK_CRITICAL", issue, resolution, "OPEN");

            } else if (snap.diskPercent() >= diskWarning) {
                String issue = String.format("Disk usage WARNING: %d%% (ngưỡng cảnh báo: %d%%)", snap.diskPercent(), diskWarning);
                saveIncidentLog(node, "DISK_WARNING", issue,
                        "Đang theo dõi. Sẽ cảnh báo nếu vượt " + diskCritical + "%.", "MONITORING");
            }

            // --- CPU ---
            if (snap.cpuPercent() >= 0 && snap.cpuPercent() >= cpuCritical) {
                String issue = String.format("CPU usage CRITICAL: %d%% (ngưỡng: %d%%)", snap.cpuPercent(), cpuCritical);
                String resolution = "Kiểm tra tiến trình đang chiếm CPU cao, cân nhắc restart service hoặc scale up.";
                outlookAlertService.sendMetricsAlert(node.getName(), snap, "CPU_CRITICAL", issue, resolution);
                saveIncidentLog(node, "CPU_CRITICAL", issue, resolution, "OPEN");
            }

            // --- Memory ---
            if (snap.memoryPercent() >= 0 && snap.memoryPercent() >= memoryCritical) {
                String issue = String.format("Memory usage CRITICAL: %d%% (ngưỡng: %d%%)", snap.memoryPercent(), memoryCritical);
                String resolution = "Kiểm tra memory leak, restart service hoặc tăng RAM.";
                outlookAlertService.sendMetricsAlert(node.getName(), snap, "MEMORY_CRITICAL", issue, resolution);
                saveIncidentLog(node, "MEMORY_CRITICAL", issue, resolution, "OPEN");
            }

        } catch (Exception e) {
            log.error("[SCHEDULER] Lỗi khi kiểm tra Node '{}': {}", node.getName(), e.getMessage());

            String issue = "Không thể thu thập metrics — Server có thể đã down hoặc unreachable";
            String resolution = "Kiểm tra network, firewall, và trạng thái server vật lý.";
            outlookAlertService.sendMetricsAlert(node.getName(), null, "SSH_FAILURE", issue, resolution);
            saveIncidentLog(node, "SSH_FAILURE", issue, resolution, "OPEN");
        }
    }

    private void saveIncidentLog(Node node, String type, String issue, String resolution, String status) {
        try {
            IncidentLog record = IncidentLog.builder()
                    .node(node)
                    .incidentType(type)
                    .issueDescription(issue)
                    .resolutionAction(resolution)
                    .status(status)
                    .detectedAt(LocalDateTime.now())
                    .build();
            incidentLogRepository.save(record);
        } catch (Exception e) {
            log.error("[SCHEDULER] Failed to save incident log for node '{}': {}", node.getName(), e.getMessage(), e);
        }
    }
}
