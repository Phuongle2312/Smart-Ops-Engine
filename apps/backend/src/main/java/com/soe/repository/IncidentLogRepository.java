package com.soe.repository;

import com.soe.entity.IncidentLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import java.util.Collection;
import java.util.List;

@Repository
public interface IncidentLogRepository extends JpaRepository<IncidentLog, Long> {
    // thêm dòng này để Spring Data JPA tự hiểu cách lấy dữ liệu
    List<IncidentLog> findTop50ByOrderByDetectedAtDesc();

    // Chống trùng: sự cố cùng loại trên cùng node còn chưa đóng thì không tạo bản ghi mới
    boolean existsByNodeIdAndIncidentTypeAndStatusIn(Long nodeId, String incidentType, Collection<String> statuses);

    long countByStatusIgnoreCase(String status);

    // Xóa node: dọn sự cố của node trước để không vướng khóa ngoại
    @Transactional
    @Modifying
    long deleteByNodeId(Long nodeId);
}
