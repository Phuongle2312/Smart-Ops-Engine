package com.soe.controller;

import com.soe.entity.Node;
import com.soe.entity.SystemConfig;
import com.soe.repository.IncidentLogRepository;
import com.soe.repository.NodeMetricRepository;
import com.soe.repository.NodeOwnerRepository;
import com.soe.repository.NodeRepository;
import com.soe.scheduler.HealthCheckScheduler;
import com.soe.service.NodeMetricsService;
import com.soe.service.OutlookAlertService;
import com.soe.service.SystemConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class NodeControllerTest {

    @Mock NodeRepository nodeRepository;
    @Mock IncidentLogRepository incidentLogRepository;
    @Mock NodeMetricRepository nodeMetricRepository;
    @Mock NodeMetricsService nodeMetricsService;
    @Mock HealthCheckScheduler healthCheckScheduler;
    @Mock OutlookAlertService outlookAlertService;
    @Mock NodeOwnerRepository nodeOwnerRepository;
    @Mock SystemConfigService systemConfigService;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new NodeController(nodeRepository, incidentLogRepository,
                nodeMetricRepository, nodeMetricsService, healthCheckScheduler, outlookAlertService,
                nodeOwnerRepository, systemConfigService)).build();
    }

    private static Node node(long id, String host) {
        return Node.builder().id(id).name("n" + id).host(host).port(22).username("u").active(true).build();
    }

    @Test
    void addNode_valid_returns201() throws Exception {
        when(nodeRepository.findByHost("10.0.0.1")).thenReturn(Optional.empty());
        when(nodeRepository.save(any(Node.class))).thenAnswer(i -> i.getArgument(0));

        mvc.perform(post("/api/nodes").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\" web \",\"host\":\"10.0.0.1\",\"username\":\"root\",\"password\":\"x\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("web"))
                .andExpect(jsonPath("$.port").value(22));
    }

    @Test
    void addNode_missingFields_returns400NotServerError() throws Exception {
        mvc.perform(post("/api/nodes").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
        mvc.perform(post("/api/nodes").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"a\",\"host\":\"h\"}"))
                .andExpect(status().isBadRequest());
        verify(nodeRepository, never()).save(any());
    }

    @Test
    void addNode_invalidPort_returns400() throws Exception {
        mvc.perform(post("/api/nodes").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"a\",\"host\":\"h\",\"username\":\"u\",\"port\":70000}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void addNode_duplicateHost_returns409() throws Exception {
        when(nodeRepository.findByHost("10.0.0.1")).thenReturn(Optional.of(node(1, "10.0.0.1")));

        mvc.perform(post("/api/nodes").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"a\",\"host\":\"10.0.0.1\",\"username\":\"u\"}"))
                .andExpect(status().isConflict());
        verify(nodeRepository, never()).save(any());
    }

    @Test
    void updateNode_hostOfAnotherNode_returns409() throws Exception {
        when(nodeRepository.findByHost("10.0.0.2")).thenReturn(Optional.of(node(2, "10.0.0.2")));

        mvc.perform(put("/api/nodes/1").contentType(MediaType.APPLICATION_JSON).content("{\"host\":\"10.0.0.2\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void updateNode_blankPassword_keepsOldPassword() throws Exception {
        Node n = node(1, "10.0.0.1");
        n.setPassword("old");
        when(nodeRepository.findById(1L)).thenReturn(Optional.of(n));
        when(nodeRepository.save(any(Node.class))).thenAnswer(i -> i.getArgument(0));

        mvc.perform(put("/api/nodes/1").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"mới\",\"password\":\"  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("mới"));
        assertEquals("old", n.getPassword());
    }

    @Test
    void deleteNode_removesDependentRowsBeforeNode() throws Exception {
        when(nodeRepository.existsById(1L)).thenReturn(true);

        mvc.perform(delete("/api/nodes/1")).andExpect(status().isNoContent());

        InOrder order = inOrder(nodeOwnerRepository, incidentLogRepository, nodeMetricRepository, nodeRepository);
        order.verify(nodeOwnerRepository).deleteByNodeId(1L);
        order.verify(incidentLogRepository).deleteByNodeId(1L);
        order.verify(nodeMetricRepository).deleteByNodeId(1L);
        order.verify(nodeRepository).deleteById(1L);
    }

    @Test
    void deleteNode_unknown_returns404() throws Exception {
        when(nodeRepository.existsById(9L)).thenReturn(false);
        mvc.perform(delete("/api/nodes/9")).andExpect(status().isNotFound());
        verify(nodeRepository, never()).deleteById(any());
    }

    @Test
    void testEmail_reportsConfiguredRecipientNotHardcodedAddress() throws Exception {
        SystemConfig cfg = new SystemConfig();
        cfg.setAlertRecipientEmail("ops@example.test");
        when(systemConfigService.getCurrentConfig()).thenReturn(cfg);

        mvc.perform(post("/api/test-email"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("ops@example.test")));
    }

    @Test
    void toggleActive_flipsFlag() throws Exception {
        Node n = node(1, "h");
        when(nodeRepository.findById(1L)).thenReturn(Optional.of(n));
        when(nodeRepository.save(any(Node.class))).thenAnswer(i -> i.getArgument(0));

        mvc.perform(put("/api/nodes/1/toggle-active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }
}
