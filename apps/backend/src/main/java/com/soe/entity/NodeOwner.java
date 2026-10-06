package com.soe.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Người / nhóm phụ trách một Node — nhận email chẩn đoán lỗi từ AI.
 * escalationOrder: 1 = người đầu tiên được báo; số lớn hơn = cấp leo thang sau (chưa tự động leo thang).
 */
@Entity
@Table(name = "Node_Owners")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NodeOwner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "node_id", nullable = false)
    private Node node;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Builder.Default
    @Column(name = "escalation_order", nullable = false)
    private Integer escalationOrder = 1;
}
