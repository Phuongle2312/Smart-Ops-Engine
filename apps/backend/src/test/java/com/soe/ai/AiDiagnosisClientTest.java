package com.soe.ai;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class AiDiagnosisClientTest {

    private static final String RESPONSE = """
            {"diagnosis_id":"d-1","image_sha256":"abc","node_id":"7","error_code":"GPU_CUDA_OOM","resource":"GPU",
             "severity":"critical","confidence":0.97,"decision":"auto_notify","source":"rules",
             "evidence":["Khớp mẫu: CUDA out of memory"],"ocr_text":"CUDA out of memory",
             "runbook":{"code":"GPU_CUDA_OOM","title":"CUDA out of memory","content":"## Nguyên nhân"},
             "related":[{"title":"x","snippet":"y","score":0.5}],"warnings":[],"elapsed_ms":12,"unexpected":"bỏ qua"}
            """;

    private MockRestServiceServer server;
    private AiDiagnosisClient client;
    private AiProperties props;

    @BeforeEach
    void setUp() {
        props = new AiProperties();
        props.setUrl("http://ai.test");
        props.setApiKey("secret");
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new AiDiagnosisClient(props, builder);
    }

    @Test
    void diagnose_parsesSnakeCaseResponseAndSendsApiKey() {
        server.expect(requestTo("http://ai.test/diagnose"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("X-API-Key", "secret"))
                .andExpect(header("Content-Type", org.hamcrest.Matchers.startsWith("multipart/form-data")))
                .andRespond(withSuccess(RESPONSE, MediaType.APPLICATION_JSON));

        DiagnosisResult r = client.diagnose(new byte[]{1, 2, 3}, "loi.png", "7", "ghi chú");

        assertEquals("d-1", r.diagnosisId());
        assertEquals("GPU_CUDA_OOM", r.errorCode());
        assertEquals(0.97, r.confidence(), 1e-9);
        assertEquals("auto_notify", r.decision());
        assertEquals("CUDA out of memory", r.runbook().title());
        assertEquals(1, r.related().size());
        assertFalse(r.isUnknown());
        server.verify();
    }

    @Test
    void diagnose_clientErrorIsReportedAsClientError() {
        server.expect(requestTo("http://ai.test/diagnose"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).body("Không đọc được ảnh"));

        AiServiceException e = assertThrows(AiServiceException.class,
                () -> client.diagnose(new byte[]{1}, "a.png", "1", ""));
        assertTrue(e.isClientError());
        assertEquals(400, e.getStatus());
    }

    @Test
    void diagnose_serverErrorIsNotClientError() {
        server.expect(requestTo("http://ai.test/diagnose")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        AiServiceException e = assertThrows(AiServiceException.class,
                () -> client.diagnose(new byte[]{1}, "a.png", "1", ""));
        assertFalse(e.isClientError());
    }

    @Test
    void sendFeedback_postsJson() {
        server.expect(requestTo("http://ai.test/feedback"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.diagnosis_id").value("d-1"))
                .andExpect(jsonPath("$.correct").value(false))
                .andExpect(jsonPath("$.correct_code").value("RAM_LEAK"))
                .andRespond(withSuccess("{\"status\":\"recorded\"}", MediaType.APPLICATION_JSON));

        client.sendFeedback("d-1", false, "RAM_LEAK", null);
        server.verify();
    }
}
