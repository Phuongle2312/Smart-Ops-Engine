package com.soe.service;

import com.soe.entity.SystemConfig;
import com.soe.repository.SystemConfigRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Nguồn sự thật duy nhất cho cấu hình SMTP / ngưỡng cảnh báo / chu kỳ quét.
 * Đọc/ghi DB, cache trong bộ nhớ để tránh query lại mỗi lần dùng.
 * Cho phép đổi cấu hình qua UI mà KHÔNG cần restart backend.
 */
@Slf4j
@Service
// init() seed cấu hình (mã hóa mật khẩu SMTP) khi DB trống — AesEncryptionUtil phải nạp khóa AES trước
@DependsOn("aesEncryptionUtil")
@RequiredArgsConstructor
public class SystemConfigService {

    private static final Long CONFIG_ID = 1L;
    private static final String EMAIL_REGEX = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";

    private final SystemConfigRepository systemConfigRepository;

    // --- Giá trị mặc định lấy từ application.properties, chỉ dùng để seed lần đầu ---
    @Value("${spring.mail.host:mail.tapdoan.local}")
    private String defaultSmtpHost;

    @Value("${spring.mail.port:25}")
    private int defaultSmtpPort;

    @Value("${spring.mail.properties.mail.smtp.auth:false}")
    private boolean defaultSmtpAuth;

    @Value("${spring.mail.properties.mail.smtp.starttls.enable:false}")
    private boolean defaultSmtpStartTls;

    @Value("${spring.mail.username:}")
    private String defaultSmtpUsername;

    @Value("${spring.mail.password:}")
    private String defaultSmtpPassword;

    @Value("${smartops.alert.recipient.email:}")
    private String defaultRecipientEmail;

    @Value("${smartops.threshold.disk-warning:80}")
    private int defaultDiskWarning;

    @Value("${smartops.threshold.disk-critical:90}")
    private int defaultDiskCritical;

    @Value("${smartops.threshold.cpu-critical:85}")
    private int defaultCpuCritical;

    @Value("${smartops.threshold.memory-critical:90}")
    private int defaultMemoryCritical;

    @Value("${smartops.scheduler.disk-check-interval-ms:300000}")
    private int defaultSchedulerIntervalMs;

    private volatile SystemConfig cachedConfig;

    @PostConstruct
    public void init() {
        cachedConfig = loadOrSeed();
    }

    public SystemConfig getCurrentConfig() {
        if (cachedConfig == null) {
            cachedConfig = loadOrSeed();
        }
        return cachedConfig;
    }

    public SystemConfig updateConfig(SystemConfig incoming) {
        validate(incoming);

        SystemConfig current = getCurrentConfig();
        current.setSmtpHost(incoming.getSmtpHost());
        current.setSmtpPort(incoming.getSmtpPort());
        current.setSmtpAuth(incoming.isSmtpAuth());
        current.setSmtpStartTls(incoming.isSmtpStartTls());
        current.setSmtpUsername(incoming.getSmtpUsername());

        // Chỉ ghi đè mật khẩu nếu người dùng thực sự nhập giá trị mới (không phải "********" mask từ FE)
        if (incoming.getSmtpPassword() != null && !incoming.getSmtpPassword().isBlank()
                && !incoming.getSmtpPassword().equals("********")) {
            current.setSmtpPassword(incoming.getSmtpPassword());
        }

        current.setAlertRecipientEmail(incoming.getAlertRecipientEmail());
        current.setDiskWarningThreshold(incoming.getDiskWarningThreshold());
        current.setDiskCriticalThreshold(incoming.getDiskCriticalThreshold());
        current.setCpuCriticalThreshold(incoming.getCpuCriticalThreshold());
        current.setMemoryCriticalThreshold(incoming.getMemoryCriticalThreshold());
        current.setSchedulerIntervalMs(incoming.getSchedulerIntervalMs());
        current.setUpdatedAt(LocalDateTime.now());

        SystemConfig saved = systemConfigRepository.save(current);
        cachedConfig = saved;
        log.info("[CONFIG] Đã cập nhật cấu hình hệ thống. SMTP host: {}, recipient: {}",
                saved.getSmtpHost(), saved.getAlertRecipientEmail());
        return saved;
    }

    private void validate(SystemConfig config) {
        if (config.getSmtpPort() == null || config.getSmtpPort() < 1 || config.getSmtpPort() > 65535) {
            throw new IllegalArgumentException("SMTP port không hợp lệ (1-65535).");
        }
        if (config.getAlertRecipientEmail() == null || !config.getAlertRecipientEmail().matches(EMAIL_REGEX)) {
            throw new IllegalArgumentException("Email nhận cảnh báo không đúng định dạng.");
        }
        requireRange(config.getDiskWarningThreshold(), "Ngưỡng disk warning");
        requireRange(config.getDiskCriticalThreshold(), "Ngưỡng disk critical");
        requireRange(config.getCpuCriticalThreshold(), "Ngưỡng CPU critical");
        requireRange(config.getMemoryCriticalThreshold(), "Ngưỡng memory critical");
        if (config.getSchedulerIntervalMs() == null || config.getSchedulerIntervalMs() < 10_000) {
            throw new IllegalArgumentException("Chu kỳ quét phải tối thiểu 10.000ms (10 giây).");
        }
    }

    private void requireRange(Integer value, String label) {
        if (value == null || value < 0 || value > 100) {
            throw new IllegalArgumentException(label + " phải trong khoảng 0-100.");
        }
    }

    private SystemConfig loadOrSeed() {
        return systemConfigRepository.findById(CONFIG_ID).orElseGet(() -> {
            log.info("[CONFIG] Chưa có system_config, tạo dòng mặc định từ application.properties");
            SystemConfig seed = new SystemConfig();
            seed.setSmtpHost(defaultSmtpHost);
            seed.setSmtpPort(defaultSmtpPort);
            seed.setSmtpAuth(defaultSmtpAuth);
            seed.setSmtpStartTls(defaultSmtpStartTls);
            seed.setSmtpUsername(defaultSmtpUsername);
            seed.setSmtpPassword(defaultSmtpPassword);
            seed.setAlertRecipientEmail(defaultRecipientEmail);
            seed.setDiskWarningThreshold(defaultDiskWarning);
            seed.setDiskCriticalThreshold(defaultDiskCritical);
            seed.setCpuCriticalThreshold(defaultCpuCritical);
            seed.setMemoryCriticalThreshold(defaultMemoryCritical);
            seed.setSchedulerIntervalMs(defaultSchedulerIntervalMs);
            seed.setUpdatedAt(LocalDateTime.now());
            return systemConfigRepository.save(seed);
        });
    }
}
