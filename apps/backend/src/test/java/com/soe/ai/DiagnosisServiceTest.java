package com.soe.ai;

import com.soe.entity.IncidentLog;
import com.soe.entity.Node;
import com.soe.entity.NodeOwner;
import com.soe.entity.SystemConfig;
import com.soe.repository.IncidentLogRepository;
import com.soe.repository.NodeOwnerRepository;
import com.soe.repository.NodeRepository;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DiagnosisServiceTest {

    private static final byte[] IMG = {1, 2, 3};

    @Mock AiDiagnosisClient client;
    @Mock NodeRepository nodeRepository;
    @Mock NodeOwnerRepository nodeOwnerRepository;
    @Mock IncidentLogRepository incidentLogRepository;
    @Mock OutlookAlertService alertService;
    @Mock SystemConfigService systemConfigService;
    @InjectMocks DiagnosisService service;

    private Node node;

    @BeforeEach
    void setUp() {
        node = Node.builder().id(7L).name("gpu-01").host("10.0.0.7").username("u").build();
        lenient().when(nodeRepository.findById(7L)).thenReturn(Optional.of(node));
        lenient().when(incidentLogRepository.save(any(IncidentLog.class))).thenAnswer(i -> i.getArgument(0));
        SystemConfig cfg = new SystemConfig();
        cfg.setAlertRecipientEmail("admin@corp.local");
        lenient().when(systemConfigService.getCurrentConfig()).thenReturn(cfg);
    }

    private static DiagnosisResult result(String code, String decision, double conf) {
        return new DiagnosisResult("d-1", code, "GPU", "critical", conf, decision, "rules",
                List.of("Khớp mẫu: CUDA out of memory"), "text",
                new DiagnosisResult.Runbook(code, "CUDA out of memory", "## Hướng xử lý"), List.of(), List.of());
    }

    private static NodeOwner owner(String email, int order) {
        return NodeOwner.builder().fullName(email).email(email).escalationOrder(order).build();
    }

    @Test
    void knownError_createsIncidentAndEmailsFirstLevelOwnersOnly() throws Exception {
        when(client.diagnose(eq(IMG), anyString(), eq("7"), any())).thenReturn(result("GPU_CUDA_OOM", "auto_notify", 0.97));
        when(nodeOwnerRepository.findByNodeIdOrderByEscalationOrderAsc(7L))
                .thenReturn(List.of(owner("a@corp.local", 1), owner("b@corp.local", 1), owner("boss@corp.local", 2)));

        IncidentLog incident = service.process(7L, IMG, "loi.png", "image/png", "").orElseThrow();

        assertEquals("GPU_CUDA_OOM", incident.getIncidentType());
        assertEquals("OPEN", incident.getStatus());
        assertEquals("d-1", incident.getDiagnosisId());
        assertEquals(0.97, incident.getAiConfidence(), 1e-9);
        assertTrue(incident.getResolutionAction().contains("CUDA out of memory"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> to = ArgumentCaptor.forClass(List.class);
        verify(alertService).sendDiagnosisReport(to.capture(), contains("GPU_CUDA_OOM"), anyString(),
                eq(IMG), eq("image/png"), eq("loi.png"));
        assertEquals(List.of("a@corp.local", "b@corp.local"), to.getValue());
    }

    @Test
    void unknownError_goesToAdminForManualLabelling() throws Exception {
        when(client.diagnose(any(), anyString(), anyString(), any())).thenReturn(result("UNKNOWN", "unknown", 0.1));

        IncidentLog incident = service.process(7L, IMG, "x.png", "image/png", "").orElseThrow();

        assertEquals("AI_UNKNOWN", incident.getIncidentType());
        verify(alertService).sendDiagnosisReport(eq(List.of("admin@corp.local")), anyString(), anyString(), any(), any(), any());
        verify(nodeOwnerRepository, never()).findByNodeIdOrderByEscalationOrderAsc(any());
    }

    @Test
    void nodeWithoutOwners_fallsBackToAdmin() throws Exception {
        when(client.diagnose(any(), anyString(), anyString(), any())).thenReturn(result("GPU_CUDA_OOM", "auto_notify", 0.9));
        when(nodeOwnerRepository.findByNodeIdOrderByEscalationOrderAsc(7L)).thenReturn(List.of());

        service.process(7L, IMG, "x.png", "image/png", "");

        verify(alertService).sendDiagnosisReport(eq(List.of("admin@corp.local")), anyString(), anyString(), any(), any(), any());
    }

    @Test
    void aiServiceDown_recordsFailureIncidentAndAlertsAdmin() throws Exception {
        when(client.diagnose(any(), anyString(), anyString(), any()))
                .thenThrow(new AiServiceException("connection refused", 0, null));

        IncidentLog incident = service.process(7L, IMG, "x.png", "image/png", "").orElseThrow();

        assertEquals("AI_DIAGNOSIS_FAILED", incident.getIncidentType());
        assertNull(incident.getDiagnosisId());
        verify(alertService).sendDiagnosisReport(eq(List.of("admin@corp.local")), contains("Không phân tích được"),
                anyString(), eq(IMG), any(), any());
    }

    @Test
    void imageRejectedByAi_createsNothing() throws Exception {
        when(client.diagnose(any(), anyString(), anyString(), any()))
                .thenThrow(new AiServiceException("Không đọc được ảnh", 400, null));

        assertTrue(service.process(7L, IMG, "x.png", "image/png", "").isEmpty());
        verify(incidentLogRepository, never()).save(any());
        verify(alertService, never()).sendDiagnosisReport(any(), any(), any(), any(), any(), any());
    }

    @Test
    void smtpFailure_doesNotLoseTheIncident() throws Exception {
        when(client.diagnose(any(), anyString(), anyString(), any())).thenReturn(result("GPU_CUDA_OOM", "auto_notify", 0.9));
        when(nodeOwnerRepository.findByNodeIdOrderByEscalationOrderAsc(7L)).thenReturn(List.of(owner("a@corp.local", 1)));
        doThrow(new org.springframework.mail.MailSendException("smtp down"))
                .when(alertService).sendDiagnosisReport(any(), any(), any(), any(), any(), any());

        assertTrue(service.process(7L, IMG, "x.png", "image/png", "").isPresent());
        verify(incidentLogRepository).save(any(IncidentLog.class));
    }

    @Test
    void unknownNode_throws() {
        when(nodeRepository.findById(99L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.process(99L, IMG, "x.png", "image/png", ""));
    }
}
