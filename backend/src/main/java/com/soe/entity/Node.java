package com.soe.entity;

import com.soe.converter.CryptoConverter;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "Nodes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Node {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "host", nullable = false, unique = true, length = 45)
    private String host;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "username", nullable = false, length = 100)
    private String username;

    @Convert(converter = CryptoConverter.class)
    @Column(name = "password")
    private String password;

    @Convert(converter = CryptoConverter.class)
    @Column(name = "ssh_key", columnDefinition = "TEXT")
    private String sshKey;

    @Builder.Default
    @Column(name = "port", nullable = false)
    private Integer port = 22;

    @Column(name = "description", length = 500)
    private String description;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    // Sửa tên để Lombok tạo ra hàm isActive() chuẩn
    private boolean active = true;
}