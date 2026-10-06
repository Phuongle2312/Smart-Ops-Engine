package com.soe.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

/** Kết quả POST /diagnose của ai-service (JSON snake_case). Trường lạ bị bỏ qua để tương thích về sau. */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record DiagnosisResult(
        String diagnosisId,
        String errorCode,
        String resource,
        String severity,
        double confidence,
        /** auto_notify | needs_review | unknown */
        String decision,
        String source,
        List<String> evidence,
        String ocrText,
        Runbook runbook,
        List<Related> related,
        List<String> warnings
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Runbook(String code, String title, String content) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Related(String title, String snippet, double score) {}

    public boolean isUnknown() {
        return "unknown".equals(decision) || "UNKNOWN".equals(errorCode);
    }

    public boolean needsReview() {
        return "needs_review".equals(decision);
    }
}
