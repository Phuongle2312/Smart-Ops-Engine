package com.soe.controller;

import com.soe.entity.Node;
import com.soe.entity.NodeOwner;
import com.soe.repository.NodeOwnerRepository;
import com.soe.repository.NodeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class NodeOwnerControllerTest {

    @Mock NodeOwnerRepository ownerRepository;
    @Mock NodeRepository nodeRepository;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new NodeOwnerController(ownerRepository, nodeRepository)).build();
    }

    private static Node node() {
        return Node.builder().id(1L).name("n").host("h").username("u").build();
    }

    @Test
    void add_valid_defaultsEscalationOrderTo1() throws Exception {
        when(nodeRepository.findById(1L)).thenReturn(Optional.of(node()));
        when(ownerRepository.save(any(NodeOwner.class))).thenAnswer(i -> i.getArgument(0));

        mvc.perform(post("/api/nodes/1/owners").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\" A \",\"email\":\"a@test.local\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fullName").value("A"))
                .andExpect(jsonPath("$.escalationOrder").value(1));
    }

    @Test
    void add_invalidEmailOrBlankName_returns400() throws Exception {
        mvc.perform(post("/api/nodes/1/owners").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"A\",\"email\":\"sai\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/nodes/1/owners").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"\",\"email\":\"a@test.local\"}"))
                .andExpect(status().isBadRequest());
        verify(ownerRepository, never()).save(any());
    }

    @Test
    void add_unknownNode_returns404() throws Exception {
        when(nodeRepository.findById(5L)).thenReturn(Optional.empty());
        mvc.perform(post("/api/nodes/5/owners").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"A\",\"email\":\"a@test.local\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void list_returnsOwnersInEscalationOrder() throws Exception {
        NodeOwner o = NodeOwner.builder().id(3L).node(node()).fullName("B").email("b@test.local").escalationOrder(2).build();
        when(ownerRepository.findByNodeIdOrderByEscalationOrderAsc(1L)).thenReturn(List.of(o));

        mvc.perform(get("/api/nodes/1/owners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value("b@test.local"));
    }

    @Test
    void delete_missing_returns404() throws Exception {
        when(ownerRepository.existsById(9L)).thenReturn(false);
        mvc.perform(delete("/api/owners/9")).andExpect(status().isNotFound());
    }
}
