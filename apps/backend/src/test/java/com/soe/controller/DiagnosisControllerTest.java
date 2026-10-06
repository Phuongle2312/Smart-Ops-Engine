package com.soe.controller;

import com.soe.ai.AiDiagnosisClient;
import com.soe.ai.AiProperties;
import com.soe.ai.AiServiceException;
import com.soe.ai.DiagnosisService;
import com.soe.entity.IncidentLog;
import com.soe.repository.IncidentLogRepository;
import com.soe.repository.NodeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class DiagnosisControllerTest {

    @Mock DiagnosisService diagnosisService;
    @Mock AiDiagnosisClient aiClient;
    @Mock NodeRepository nodeRepository;
    @Mock IncidentLogRepository incidentLogRepository;

    private AiProperties props;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        props = new AiProperties();
        mvc = MockMvcBuilders.standaloneSetup(
                new DiagnosisController(diagnosisService, aiClient, props, nodeRepository, incidentLogRepository)).build();
    }

    private static MockMultipartFile png() {
        return new MockMultipartFile("file", "loi.png", "image/png", new byte[]{1, 2, 3});
    }

    @Test
    void validImage_returns202AndSubmitsAsync() throws Exception {
        when(nodeRepository.existsById(7L)).thenReturn(true);

        mvc.perform(multipart("/api/diagnose").file(png()).param("nodeId", "7").param("note", "ghi chú"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("PROCESSING"));

        verify(diagnosisService).submit(eq(7L), any(byte[].class), eq("loi.png"), eq("image/png"), eq("ghi chú"));
    }

    @Test
    void nonImageContentType_returns400() throws Exception {
        MockMultipartFile pdf = new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[]{1});

        mvc.perform(multipart("/api/diagnose").file(pdf).param("nodeId", "7"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(diagnosisService);
    }

    @Test
    void emptyFile_returns400() throws Exception {
        MockMultipartFile empty = new MockMultipartFile("file", "a.png", "image/png", new byte[0]);

        mvc.perform(multipart("/api/diagnose").file(empty).param("nodeId", "7")).andExpect(status().isBadRequest());
    }

    @Test
    void unknownNode_returns404() throws Exception {
        when(nodeRepository.existsById(9L)).thenReturn(false);

        mvc.perform(multipart("/api/diagnose").file(png()).param("nodeId", "9")).andExpect(status().isNotFound());
        verifyNoInteractions(diagnosisService);
    }

    @Test
    void featureDisabled_returns503() throws Exception {
        props.setEnabled(false);

        mvc.perform(multipart("/api/diagnose").file(png()).param("nodeId", "7")).andExpect(status().isServiceUnavailable());
    }

    @Test
    void feedback_forwardsToAiService() throws Exception {
        IncidentLog incident = IncidentLog.builder().diagnosisId("d-1").build();
        when(incidentLogRepository.findById(5L)).thenReturn(Optional.of(incident));

        mvc.perform(post("/api/incidents/5/ai-feedback").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correct\":false,\"correctCode\":\"RAM_LEAK\",\"comment\":\"sai\"}"))
                .andExpect(status().isOk());

        verify(aiClient).sendFeedback("d-1", false, "RAM_LEAK", "sai");
    }

    @Test
    void feedback_onNonAiIncident_returns409() throws Exception {
        when(incidentLogRepository.findById(5L)).thenReturn(Optional.of(IncidentLog.builder().build()));

        mvc.perform(post("/api/incidents/5/ai-feedback").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correct\":true}"))
                .andExpect(status().isConflict());
    }

    @Test
    void feedback_aiServiceDown_returns502() throws Exception {
        when(incidentLogRepository.findById(5L)).thenReturn(Optional.of(IncidentLog.builder().diagnosisId("d-1").build()));
        doThrow(new AiServiceException("down", 0, null)).when(aiClient).sendFeedback(any(), eq(true), any(), any());

        mvc.perform(post("/api/incidents/5/ai-feedback").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correct\":true}"))
                .andExpect(status().isBadGateway());
    }
}
