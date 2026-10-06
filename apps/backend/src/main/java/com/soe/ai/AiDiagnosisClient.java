package com.soe.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.Map;

/** Client REST gọi ai-service (xem docs/ai-diagnosis/SRS.md mục 4). */
@Slf4j
@Component
public class AiDiagnosisClient {

    private final RestClient client;
    private final AiProperties props;

    // Có 2 constructor nên phải chỉ rõ cái Spring dùng
    @Autowired
    public AiDiagnosisClient(AiProperties props) {
        this(props, RestClient.builder().requestFactory(timeouts(props)));
    }

    /** Dùng cho test: truyền builder đã gắn MockRestServiceServer (giữ nguyên request factory của nó). */
    AiDiagnosisClient(AiProperties props, RestClient.Builder builder) {
        this.props = props;
        this.client = builder.baseUrl(props.getUrl()).build();
    }

    private static SimpleClientHttpRequestFactory timeouts(AiProperties props) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(props.getConnectTimeoutMs());
        factory.setReadTimeout(props.getTimeoutMs());
        return factory;
    }

    public DiagnosisResult diagnose(byte[] image, String filename, String nodeId, String note) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", namedResource(image, filename));
        body.add("node_id", nodeId == null ? "" : nodeId);
        body.add("note", note == null ? "" : note);
        try {
            DiagnosisResult result = client.post().uri("/diagnose")
                    .headers(this::addKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(DiagnosisResult.class);
            if (result == null || result.errorCode() == null) {
                throw new AiServiceException("ai-service trả phản hồi rỗng", 0, null);
            }
            return result;
        } catch (RestClientResponseException e) {
            throw new AiServiceException("ai-service từ chối (HTTP " + e.getStatusCode().value() + "): "
                    + e.getResponseBodyAsString(), e.getStatusCode().value(), e);
        } catch (RestClientException e) {
            throw new AiServiceException("Không gọi được ai-service: " + e.getMessage(), 0, e);
        }
    }

    public void sendFeedback(String diagnosisId, boolean correct, String correctCode, String comment) {
        try {
            client.post().uri("/feedback")
                    .headers(this::addKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "diagnosis_id", diagnosisId,
                            "correct", correct,
                            "correct_code", correctCode == null ? "" : correctCode,
                            "comment", comment == null ? "" : comment))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            throw new AiServiceException("ai-service từ chối phản hồi (HTTP " + e.getStatusCode().value() + "): "
                    + e.getResponseBodyAsString(), e.getStatusCode().value(), e);
        } catch (RestClientException e) {
            throw new AiServiceException("Không gọi được ai-service: " + e.getMessage(), 0, e);
        }
    }

    private void addKey(HttpHeaders headers) {
        if (props.getApiKey() != null && !props.getApiKey().isBlank()) {
            headers.set("X-API-Key", props.getApiKey());
        }
    }

    private static ByteArrayResource namedResource(byte[] data, String filename) {
        String name = (filename == null || filename.isBlank()) ? "image.png" : filename;
        return new ByteArrayResource(data) {
            @Override
            public String getFilename() {
                return name;
            }
        };
    }
}
