package com.soe.controller;

import com.soe.entity.SystemConfig;
import com.soe.service.OutlookAlertService;
import com.soe.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * SystemConfigController — cho phép IT/network tự đổi SMTP, email nhận cảnh báo,
 * ngưỡng cảnh báo qua giao diện web, không cần sửa application.properties + restart.
 *
 * LƯU Ý BẢO MẬT (demo-grade): backend chưa có Spring Security/JWT thật (v2.0 kế hoạch),
 * nên các endpoint này CHƯA được bảo vệ ở tầng API — chỉ ẩn menu ở FE theo role mock.
 * Cần bổ sung auth thật trước khi mở cho nhiều người dùng thật.
 */
@Slf4j
@RestController
@RequestMapping("/api/system-config")
@RequiredArgsConstructor
public class SystemConfigController {

    private static final String MASKED_PASSWORD = "********";

    private final SystemConfigService systemConfigService;
    private final OutlookAlertService outlookAlertService;

    @GetMapping
    public ResponseEntity<SystemConfig> getConfig() {
        SystemConfig config = systemConfigService.getCurrentConfig();
        return ResponseEntity.ok(maskPassword(config));
    }

    @PutMapping
    public ResponseEntity<?> updateConfig(@RequestBody SystemConfig incoming) {
        try {
            SystemConfig saved = systemConfigService.updateConfig(incoming);
            log.info("[API] Đã cập nhật System Config");
            return ResponseEntity.ok(maskPassword(saved));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/test-email")
    public ResponseEntity<Map<String, String>> testEmail(@RequestBody SystemConfig candidateConfig) {
        try {
            outlookAlertService.sendTestEmail(candidateConfig);
            return ResponseEntity.ok(Map.of(
                    "status", "SENT",
                    "message", "Email thử đã gửi tới " + candidateConfig.getAlertRecipientEmail()
            ));
        } catch (Exception e) {
            log.error("[API] Gửi email thử thất bại: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "status", "FAILED",
                    "message", e.getMessage()
            ));
        }
    }

    /**
     * Không bao giờ trả plaintext mật khẩu SMTP ra ngoài — chỉ báo đã set hay chưa.
     * QUAN TRỌNG: trả về BẢN SAO, không sửa trực tiếp lên object mà SystemConfigService
     * đang cache trong bộ nhớ (nếu sửa tại chỗ sẽ làm mất password thật dùng để gửi mail).
     */
    private SystemConfig maskPassword(SystemConfig source) {
        SystemConfig copy = new SystemConfig();
        copy.setId(source.getId());
        copy.setSmtpHost(source.getSmtpHost());
        copy.setSmtpPort(source.getSmtpPort());
        copy.setSmtpAuth(source.isSmtpAuth());
        copy.setSmtpStartTls(source.isSmtpStartTls());
        copy.setSmtpUsername(source.getSmtpUsername());
        copy.setSmtpPassword(source.getSmtpPassword() != null && !source.getSmtpPassword().isBlank()
                ? MASKED_PASSWORD : "");
        copy.setAlertRecipientEmail(source.getAlertRecipientEmail());
        copy.setDiskWarningThreshold(source.getDiskWarningThreshold());
        copy.setDiskCriticalThreshold(source.getDiskCriticalThreshold());
        copy.setCpuCriticalThreshold(source.getCpuCriticalThreshold());
        copy.setMemoryCriticalThreshold(source.getMemoryCriticalThreshold());
        copy.setSchedulerIntervalMs(source.getSchedulerIntervalMs());
        copy.setUpdatedAt(source.getUpdatedAt());
        return copy;
    }
}
