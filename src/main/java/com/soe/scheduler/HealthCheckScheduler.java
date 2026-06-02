package com.soe.scheduler;

import com.soe.entity.IncidentLog;
import com.soe.entity.Node;
import com.soe.repository.IncidentLogRepository;
import com.soe.repository.NodeRepository;
import com.soe.service.LocalMetricsService;
import com.soe.service.OutlookAlertService;
import com.soe.service.SshService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * HealthCheckScheduler — "Bộ não" giám sát định kỳ.
 *
 * <p>Đây là lớp trung tâm kết nối toàn bộ hệ thống lại với nhau:
 * <ol>
 *   <li>Lấy danh sách Node từ database</li>
 *   <li>SSH vào từng Node kiểm tra disk, CPU, memory</li>
 *   <li>Nếu vượt ngưỡng → gửi alert qua Outlook + ghi Incident Log</li>
 * </ol>
 *
 * <p><b>Cấu hình ngưỡng cảnh báo:</b> trong application.properties
 * <pre>
 * smartops.threshold.disk-warning=80
 * smartops.threshold.disk-critical=90
 * smartops.threshold.cpu-warning=85
 * </pre>
 *
 * @author Smart Ops Engine
 */
@Slf4j
@Component
@RequiredArgsConstructor

public class HealthCheckScheduler {

    // Lệnh kiểm tra disk — lấy % sử dụng của phân vùng root
    private static final String CMD_DISK_USAGE = "df -h / | awk 'NR==2 {print $5}' | tr -d '%'";

    // Lệnh kiểm tra CPU load (1 phút) — dùng top snapshot mode
    private static final String CMD_CPU_LOAD = "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1";

    // Ngưỡng cảnh báo (%)
    private static final int DISK_CRITICAL_THRESHOLD = 90;
    private static final int DISK_WARNING_THRESHOLD = 80;

    private final NodeRepository nodeRepository;
    private final IncidentLogRepository incidentLogRepository;
    private final SshService sshService;
    private final OutlookAlertService outlookAlertService;
    private final LocalMetricsService localHealthCheckService;

    /**
     * Health check toàn bộ Node mỗi 5 phút.
     *
     * <p>fixedDelay đảm bảo lần chạy sau chỉ bắt đầu sau khi lần trước HOÀN THÀNH —
     * tránh race condition nếu số lượng Node lớn và SSH timeout.
     * initialDelay=60s để chờ Spring Boot khởi động xong trước khi chạy lần đầu.
     */
    @Scheduled(fixedDelayString = "${smartops.scheduler.disk-check-interval-ms:300000}",
               initialDelay = 60_000)
    public void runDiskHealthCheck() {
        log.info("[SCHEDULER] === Starting disk health check cycle ===");

        // Chỉ lấy Node đang active (không check Node đã disabled)./mvnw spring-boot:run -DskipTests
        List<Node> activeNodes = nodeRepository.findByActiveTrue();
        log.info("[SCHEDULER] Found {} active node(s) to check", activeNodes.size());

        for (Node node : activeNodes) {
            checkDiskUsage(node);
        }

        log.info("[SCHEDULER] === Disk health check cycle completed ===");
    }

    /**
     * Kiểm tra disk mỗi giờ cho lần chạy báo cáo đầy đủ.
     * Có thể dùng cho báo cáo định kỳ gửi Manager.
     */
    @Scheduled(cron = "${smartops.scheduler.daily-report-cron:0 0 8 * * MON-FRI}")
    public void runDailyReport() {
        log.info("[SCHEDULER] Running daily morning health report...");
        List<Node> activeNodes = nodeRepository.findByActiveTrue();
        long openIncidentsCount = incidentLogRepository.findAll().stream()
                .filter(inc -> "OPEN".equalsIgnoreCase(inc.getStatus()))
                .count();
        outlookAlertService.sendDailySummaryReport(activeNodes.size(), openIncidentsCount);
    }

    // -------------------------------------------------------------------------
    // Private check methods — mỗi method chịu trách nhiệm 1 loại check
    // -------------------------------------------------------------------------

    /**
     * Kiểm tra disk của một Node, xử lý và log kết quả.
     */
    private void checkDiskUsage(Node node) {
        try {
        int diskUsagePercent;

        // Cơ chế tự thích ứng (Adaptive)
        if (node.getHost().equals("127.0.0.1") || node.getHost().equalsIgnoreCase("localhost")) {
            log.info("[CHECK] Phát hiện Node Local. Đọc thông số trực tiếp từ Windows không qua SSH.");
            diskUsagePercent = (int)localHealthCheckService.getPrimaryDiskUsagePercent();
        } else {
            // Nếu là server từ xa, giữ nguyên logic bắn lệnh SSH cũ
            String rawOutput = sshService.executeCommand(node, CMD_DISK_USAGE);
            diskUsagePercent = parseIntSafely(rawOutput, node.getName());
        }

        if (diskUsagePercent < 0) return;

        log.info("[CHECK] Node '{}' disk usage: {}%", node.getName(), diskUsagePercent);
        // Đoạn quyết định gửi mail: ktra ngưỡng và bắn alert email
        if (diskUsagePercent >= DISK_CRITICAL_THRESHOLD) {
            handleCriticalDisk(node, diskUsagePercent);
        } else if (diskUsagePercent >= DISK_WARNING_THRESHOLD) {
            handleWarningDisk(node, diskUsagePercent);
        }

        } catch (Exception e) {
        log.error("[SCHEDULER] Lỗi khi kiểm tra Node '{}': {}", node.getName(), e.getMessage());
        }
    }
       
    

    /**
     * Xử lý khi disk vượt ngưỡng CRITICAL (>= 90%).
     * Gửi alert + ghi incident log với độ ưu tiên cao.
     */
    private void handleCriticalDisk(Node node, int usagePercent) {
        String issue = String.format("Disk usage CRITICAL: %d%% (ngưỡng: %d%%)",
                usagePercent, DISK_CRITICAL_THRESHOLD);
        String resolution = "Hệ thống đã ghi nhận. Cần xem xét ngay: dọn log cũ, "
                + "xóa temp files, hoặc mở rộng dung lượng.";

        log.warn("[ALERT] {} on node '{}'", issue, node.getName());

        // Gửi alert email
        outlookAlertService.sendIncidentReport(node.getName(), issue, resolution);

        // Ghi vào database
        saveIncidentLog(node, "DISK_CRITICAL", issue, resolution, "OPEN");
    }

    /**
     * Xử lý khi disk ở mức WARNING (80–89%).
     * Chỉ ghi log, không gửi email để tránh spam.
     * Có thể bật email warning trong application.properties nếu cần.
     */
    private void handleWarningDisk(Node node, int usagePercent) {
        String issue = String.format("Disk usage WARNING: %d%% (ngưỡng cảnh báo: %d%%)",
                usagePercent, DISK_WARNING_THRESHOLD);
        String resolution = "Đang theo dõi. Sẽ cảnh báo nếu vượt " + DISK_CRITICAL_THRESHOLD + "%.";

        log.warn("[WARNING] {} on node '{}'", issue, node.getName());
        saveIncidentLog(node, "DISK_WARNING", issue, resolution, "MONITORING");
    }

    /**
     * Xử lý khi không SSH được vào Node — server có thể đã down.
     */
    private void handleSshFailure(Node node, SshService.SshExecutionException e) {
        String issue = "Không thể kết nối SSH — Server có thể đã down hoặc unreachable";
        String resolution = "Kiểm tra network, firewall, và trạng thái server vật lý.";

        log.error("[ALERT] SSH failed for node '{}': {}", node.getName(), e.getMessage());

        outlookAlertService.sendIncidentReport(node.getName(), issue, resolution);
        saveIncidentLog(node, "SSH_FAILURE", issue, resolution, "OPEN");
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    /**
     * Lưu sự kiện vào bảng incident_logs.
     * Bắt exception để lỗi DB không làm sập scheduler.
     */
    private void saveIncidentLog(Node node, String type, String issue,
                                  String resolution, String status) {
        try {
            IncidentLog log = IncidentLog.builder()
                    .node(node)
                    .incidentType(type)
                    .issueDescription(issue)
                    .resolutionAction(resolution)
                    .status(status)
                    .detectedAt(LocalDateTime.now())
                    .build();
            incidentLogRepository.save(log);
        } catch (Exception e) {
            log.error("[SCHEDULER] Failed to save incident log for node '{}': {}",
                    node.getName(), e.getMessage(), e);
        }
    }

    /**
     * Parse String thành int an toàn, không throw exception.
     * @return giá trị int, hoặc -1 nếu parse thất bại
     */
    private int parseIntSafely(String value, String nodeName) {
        try {
            return Integer.parseInt(value.replace("%", "").trim());
        } catch (NumberFormatException e) {
            log.warn("[CHECK] Cannot parse disk usage value '{}' from node '{}'. Skipping.",
                    value, nodeName);
            return -1;
        }
    }
}


