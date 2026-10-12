package com.soe.repository;

import com.soe.entity.NodeOwner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface NodeOwnerRepository extends JpaRepository<NodeOwner, Long> {
    List<NodeOwner> findByNodeIdOrderByEscalationOrderAsc(Long nodeId);

    @Transactional
    @Modifying
    long deleteByNodeId(Long nodeId);
}
