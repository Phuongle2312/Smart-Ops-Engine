package com.soe.repository;

import com.soe.entity.NodeMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface NodeMetricRepository extends JpaRepository<NodeMetric, Long> {

    List<NodeMetric> findTop50ByNodeIdOrderByRecordedAtDesc(Long nodeId);

    Optional<NodeMetric> findFirstByNodeIdOrderByRecordedAtDesc(Long nodeId);

    List<NodeMetric> findByNodeIdAndRecordedAtAfterOrderByRecordedAtAsc(Long nodeId, LocalDateTime since);

    // Xóa node: dọn lịch sử metrics của node trước để không vướng khóa ngoại
    @Transactional
    @Modifying
    long deleteByNodeId(Long nodeId);

    // Job dọn dẹp: xóa metrics cũ hơn mốc retention
    @Transactional
    @Modifying
    long deleteByRecordedAtBefore(LocalDateTime cutoff);
}
