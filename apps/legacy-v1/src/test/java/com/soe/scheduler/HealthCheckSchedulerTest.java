package com.soe.scheduler;

import com.soe.entity.IncidentLog;
import com.soe.entity.Node;
import com.soe.entity.SystemConfig;
import com.soe.repository.IncidentLogRepository;
import com.soe.repository.NodeRepository;
import com.soe.service.NodeMetricsService;
import com.soe.service.NodeMetricsService.NodeMetricsSnapshot;
import com.soe.service.OutlookAlertService;
import com.soe.service.SystemConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HealthCheckSchedulerTest {

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private IncidentLogRepository incidentLogRepository;

    @Mock
    private OutlookAlertService outlookAlertService;

    @Mock
    private NodeMetricsService nodeMetricsService;

    @Mock
    private SystemConfigService systemConfigService;

    @InjectMocks
    private HealthCheckScheduler healthCheckScheduler;

    private Node node;

    @BeforeEach
    void setUp() {
        node = Node.builder()
                .name("test-server.local")
                .host("192.168.1.100")
                .active(true)
                .build();

        // Ngưỡng mặc định giống application.properties: disk 80/90, cpu 85, memory 90
        SystemConfig config = new SystemConfig();
        config.setDiskWarningThreshold(80);
        config.setDiskCriticalThreshold(90);
        config.setCpuCriticalThreshold(85);
        config.setMemoryCriticalThreshold(90);

        when(nodeRepository.findByActiveTrue()).thenReturn(List.of(node));
        lenient().when(systemConfigService.getCurrentConfig()).thenReturn(config);
    }

    @Test
    void diskVuotNguongCritical_guiCanhBaoVaGhiIncidentOpen() throws Exception {
        NodeMetricsSnapshot snap = new NodeMetricsSnapshot(95, 10, 20);
        when(nodeMetricsService.collectAndSave(node)).thenReturn(snap);

        healthCheckScheduler.runDiskHealthCheck();

        verify(outlookAlertService).sendMetricsAlert(eq("test-server.local"), eq(snap), eq("DISK_CRITICAL"), anyString(), anyString());
        IncidentLog saved = captureSingleIncident();
        assertEquals("DISK_CRITICAL", saved.getIncidentType());
        assertEquals("OPEN", saved.getStatus());
    }

    @Test
    void diskVuotNguongWarning_chiGhiIncidentMonitoring_khongGuiEmail() throws Exception {
        when(nodeMetricsService.collectAndSave(node)).thenReturn(new NodeMetricsSnapshot(85, 10, 20));

        healthCheckScheduler.runDiskHealthCheck();

        verify(outlookAlertService, never()).sendMetricsAlert(anyString(), any(), anyString(), anyString(), anyString());
        IncidentLog saved = captureSingleIncident();
        assertEquals("DISK_WARNING", saved.getIncidentType());
        assertEquals("MONITORING", saved.getStatus());
    }

    @Test
    void metricsBinhThuong_khongCanhBao_khongGhiIncident() throws Exception {
        when(nodeMetricsService.collectAndSave(node)).thenReturn(new NodeMetricsSnapshot(40, 30, 50));

        healthCheckScheduler.runDiskHealthCheck();

        verify(incidentLogRepository, never()).save(any());
        verify(outlookAlertService, never()).sendMetricsAlert(anyString(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void cpuVaMemoryVuotNguong_guiHaiCanhBao() throws Exception {
        when(nodeMetricsService.collectAndSave(node)).thenReturn(new NodeMetricsSnapshot(40, 90, 95));

        healthCheckScheduler.runDiskHealthCheck();

        verify(outlookAlertService).sendMetricsAlert(eq("test-server.local"), any(), eq("CPU_CRITICAL"), anyString(), anyString());
        verify(outlookAlertService).sendMetricsAlert(eq("test-server.local"), any(), eq("MEMORY_CRITICAL"), anyString(), anyString());
        verify(incidentLogRepository, times(2)).save(any());
    }

    @Test
    void cpuKhongDoDuoc_giaTriAm_khongCanhBaoCpu() throws Exception {
        when(nodeMetricsService.collectAndSave(node)).thenReturn(new NodeMetricsSnapshot(40, -1, -1));

        healthCheckScheduler.runDiskHealthCheck();

        verify(incidentLogRepository, never()).save(any());
    }

    @Test
    void khongThuThapDuocMetrics_ghiIncidentSshFailure() throws Exception {
        when(nodeMetricsService.collectAndSave(node)).thenThrow(new RuntimeException("SSH timeout"));

        healthCheckScheduler.runDiskHealthCheck();

        verify(outlookAlertService).sendMetricsAlert(eq("test-server.local"), isNull(), eq("SSH_FAILURE"), anyString(), anyString());
        assertEquals("SSH_FAILURE", captureSingleIncident().getIncidentType());
    }

    private IncidentLog captureSingleIncident() {
        ArgumentCaptor<IncidentLog> captor = ArgumentCaptor.forClass(IncidentLog.class);
        verify(incidentLogRepository, times(1)).save(captor.capture());
        return captor.getValue();
    }
}
