package com.soe.controller;

import com.soe.entity.NodeOwner;
import com.soe.repository.NodeOwnerRepository;
import com.soe.repository.NodeRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Người phụ trách từng node — người nhận email chẩn đoán lỗi. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class NodeOwnerController {

    private final NodeOwnerRepository ownerRepository;
    private final NodeRepository nodeRepository;

    public record OwnerRequest(
            @NotBlank String fullName,
            @NotBlank @Email String email,
            @Min(1) Integer escalationOrder) {}

    public record OwnerResponse(Long id, Long nodeId, String fullName, String email, Integer escalationOrder) {
        static OwnerResponse from(NodeOwner o) {
            return new OwnerResponse(o.getId(), o.getNode().getId(), o.getFullName(), o.getEmail(), o.getEscalationOrder());
        }
    }

    @GetMapping("/nodes/{nodeId}/owners")
    public ResponseEntity<List<OwnerResponse>> list(@PathVariable Long nodeId) {
        return ResponseEntity.ok(ownerRepository.findByNodeIdOrderByEscalationOrderAsc(nodeId).stream()
                .map(OwnerResponse::from).toList());
    }

    @PostMapping("/nodes/{nodeId}/owners")
    public ResponseEntity<OwnerResponse> add(@PathVariable Long nodeId, @Valid @RequestBody OwnerRequest req) {
        return nodeRepository.findById(nodeId)
                .map(node -> {
                    NodeOwner saved = ownerRepository.save(NodeOwner.builder()
                            .node(node)
                            .fullName(req.fullName().trim())
                            .email(req.email().trim())
                            .escalationOrder(req.escalationOrder() != null ? req.escalationOrder() : 1)
                            .build());
                    return ResponseEntity.status(HttpStatus.CREATED).body(OwnerResponse.from(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/owners/{ownerId}")
    public ResponseEntity<Void> delete(@PathVariable Long ownerId) {
        if (!ownerRepository.existsById(ownerId)) {
            return ResponseEntity.notFound().build();
        }
        ownerRepository.deleteById(ownerId);
        return ResponseEntity.noContent().build();
    }
}
