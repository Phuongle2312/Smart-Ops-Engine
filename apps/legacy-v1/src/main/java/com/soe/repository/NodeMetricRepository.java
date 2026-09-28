package com.soe.repository;

import com.soe.entity.NodeMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NodeMetricRepository extends JpaRepository<NodeMetric, Long> {

    List<NodeMetric> findTop50ByNodeIdOrderByRecordedAtDesc(Long nodeId);
}
