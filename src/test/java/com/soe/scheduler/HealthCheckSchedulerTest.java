package com.soe.scheduler;

import com.soe.entity.Node;
import com.soe.repository.IncidentLogRepository;
import com.soe.repository.NodeRepository;
import com.soe.service.LocalMetricsService; // Thêm import mới
import com.soe.service.OutlookAlertService;
import com.soe.service.SshService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class HealthCheckSchedulerTest {

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private SshService sshService;

    @Mock
    private OutlookAlertService outlookAlertService;

    @Mock
    private IncidentLogRepository incidentLogRepository;

    // ✅ SỬA LỖI 1: Thêm Mock này để Mockito inject thành công vào HealthCheckScheduler
    @Mock
    private LocalMetricsService localHealthCheckService; 

    @InjectMocks
    private HealthCheckScheduler healthCheckScheduler;

    // ✅ SỬA LỖI 3: Đổi tên Exception cho đúng chuẩn cấu hình SshService của bạn
    @Test
    void testPerformDiskHealthCheck_HighUsage_TriggersAlert() throws Exception {
        // Arrange
        Node mockNode = Node.builder()
                .name("test-server.local")
                .host("192.168.1.100")
                .active(true)
                .build();
        
        // ✅ SỬA LỖI 2: Đổi từ findByIsActiveTrue() thành findByActiveTrue()
        when(nodeRepository.findByActiveTrue()).thenReturn(List.of(mockNode));
        when(sshService.executeCommand(eq(mockNode), anyString())).thenReturn("95%"); 

        // Act
        healthCheckScheduler.runDiskHealthCheck();

        // Assert
        verify(incidentLogRepository, times(1)).save(any());
        verify(outlookAlertService, times(1)).sendIncidentReport(eq("test-server.local"), anyString(), anyString());
    }

    @Test
    void testPerformDiskHealthCheck_NormalUsage_NoAlert() throws Exception {
        // Arrange
        Node mockNode = Node.builder()
                .name("test-server-2.local")
                .host("192.168.1.101")
                .active(true)
                .build();
        
        // ✅ SỬA LỖI 2: Đổi từ findByIsActiveTrue() thành findByActiveTrue()
        when(nodeRepository.findByActiveTrue()).thenReturn(List.of(mockNode));
        when(sshService.executeCommand(eq(mockNode), anyString())).thenReturn("40%"); 

        // Act
        healthCheckScheduler.runDiskHealthCheck();

        // Assert
        verify(incidentLogRepository, never()).save(any());
        verify(outlookAlertService, never()).sendIncidentReport(anyString(), anyString(), anyString());
    }
}