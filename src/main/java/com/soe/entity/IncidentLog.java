package com.soe.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "Incident_Logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncidentLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Node xảy ra sự cố — Many incidents can belong to one Node */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "node_id", nullable = false)
    private Node node;

    /**
     * Loại sự cố: DISK_CRITICAL, DISK_WARNING, SSH_FAILURE, CPU_HIGH, v.v.
     * Dùng String thay enum để dễ mở rộng không cần migration DB.
     */
    @Column(name = "incident_type", nullable = false, length = 50)
    private String incidentType;

    /** Mô tả chi tiết sự cố — ghi rõ giá trị thực đo được */
    @Column(name = "issue_description", nullable = false, columnDefinition = "TEXT")
    private String issueDescription;

    /** Hành động đã/sẽ thực hiện */
    @Column(name = "resolution_action", columnDefinition = "TEXT")
    private String resolutionAction;

    /**
     * Trạng thái: OPEN | MONITORING | RESOLVED | ACKNOWLEDGED
     * Cập nhật thủ công qua API hoặc tự động bởi auto-remediation module.
     */
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "OPEN";

    /** Thời điểm hệ thống phát hiện sự cố */
    @Column(name = "detected_at", nullable = false)
    private LocalDateTime detectedAt;

    /** Thời điểm sự cố được giải quyết — null nếu còn OPEN */
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;
}
