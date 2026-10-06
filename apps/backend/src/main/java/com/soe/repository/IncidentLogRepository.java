package com.soe.repository;

import com.soe.entity.IncidentLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface IncidentLogRepository extends JpaRepository<IncidentLog, Long> {
    // thêm dòng này để Spring Data JPA tự hiểu cách lấy dữ liệu
    List<IncidentLog> findTop50ByOrderByDetectedAtDesc();   
}
