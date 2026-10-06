package com.soe.ai;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Cấu hình gọi ai-service (smartops.ai.*). */
@Component
@ConfigurationProperties(prefix = "smartops.ai")
@Getter
@Setter
public class AiProperties {
    /** Tắt hẳn chức năng chẩn đoán ảnh khi false. */
    private boolean enabled = true;
    private String url = "http://localhost:8001";
    /** Gửi kèm header X-API-Key nếu không rỗng. */
    private String apiKey = "";
    /** Vision LLM trên CPU có thể mất cả phút — mặc định 3 phút. */
    private int timeoutMs = 180_000;
    private int connectTimeoutMs = 5_000;
}
