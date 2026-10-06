package com.soe.ai;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DiagnosisEmailTemplateTest {

    private static DiagnosisResult result(String decision, String ocr) {
        return new DiagnosisResult("d-1", "GPU_CUDA_OOM", "GPU", "critical", 0.9, decision, "rules",
                List.of("<img src=x onerror=alert(1)>"), ocr,
                new DiagnosisResult.Runbook("GPU_CUDA_OOM", "CUDA <b>OOM</b>", "chạy: nvidia-smi && echo <script>"),
                List.of(), List.of("<warn>"));
    }

    @Test
    void untrustedTextIsHtmlEscaped() {
        String html = DiagnosisEmailTemplate.build("node<script>", result("auto_notify", ""), "now", true);

        assertFalse(html.contains("<script>"));
        assertFalse(html.contains("<img src=x"));
        assertFalse(html.contains("<warn>"));
        assertTrue(html.contains("&lt;script&gt;"));
        assertTrue(html.contains("nvidia-smi &amp;&amp; echo"));
    }

    @Test
    void includesInlineImageAndRunbookGuidance() {
        String html = DiagnosisEmailTemplate.build("gpu-01", result("auto_notify", ""), "now", true);

        assertTrue(html.contains("cid:error-image"));
        assertTrue(html.contains("không tự chạy lệnh"));
    }

    @Test
    void needsReviewShowsConfirmationBanner() {
        assertTrue(DiagnosisEmailTemplate.build("n", result("needs_review", ""), "now", false).contains("Cần xác nhận"));
        assertFalse(DiagnosisEmailTemplate.build("n", result("needs_review", ""), "now", false).contains("cid:error-image"));
    }

    @Test
    void subjectReflectsDecision() {
        assertTrue(DiagnosisEmailTemplate.subject("gpu-01", result("auto_notify", "")).contains("GPU_CUDA_OOM"));
        assertTrue(DiagnosisEmailTemplate.subject("gpu-01", result("needs_review", "")).contains("Cần xác nhận"));
    }
}
