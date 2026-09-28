package com.soe.entity;

import com.soe.converter.CryptoConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Cấu hình hệ thống — chỉ có duy nhất 1 dòng (id = 1L).
 * Cho phép IT/network tự đổi SMTP, email nhận cảnh báo, ngưỡng cảnh báo
 * qua giao diện web thay vì sửa application.properties + restart.
 */
@Entity
@Table(name = "system_config")
@Getter
@Setter
public class SystemConfig {

    @Id
    private Long id = 1L;

    private String smtpHost;
    private Integer smtpPort;
    private boolean smtpAuth;
    private boolean smtpStartTls;
    private String smtpUsername;

    @Convert(converter = CryptoConverter.class)
    private String smtpPassword;

    private String alertRecipientEmail;

    private Integer diskWarningThreshold;
    private Integer diskCriticalThreshold;
    private Integer cpuCriticalThreshold;
    private Integer memoryCriticalThreshold;
    private Integer schedulerIntervalMs;

    private LocalDateTime updatedAt;
}
